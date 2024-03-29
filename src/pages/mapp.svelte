<script lang="ts">
  import {
    mask,
    overlays,
    overlaysFeature,
    sEvent,
    sFeatureData,
    sId,
    sMapp,
    sOverlay,
    userState
  } from '$lib/store';
  import type { Sample } from '$src/lib/data/objects/sample';
  import { oneLRU } from '$src/lib/lru';
  import ImgControl from '$src/lib/ui/background/imgControl.svelte';
  import { handleError } from '$src/lib/utils';

  import { isEqual } from 'lodash-es';
  import 'ol/ol.css';
  import { onMount } from 'svelte';
  import { Mapp } from '../lib/ui/mapp';

  export let sample: Sample | undefined;
  // let currSample: string;
  $: sample
    ?.hydrate()
    .then(updateSample)
    .catch((e) => handleError(e));

  $: showImgControl = $userState.showImgControl;
  $: console.log(sample);

  export let uid: number;
  const mapName = `map-${uid}`;
  let mapElem: HTMLDivElement;
  let tippyElem: HTMLDivElement;
  let map = new Mapp();
  $sMapp = map;

  let width: number;
  let height: number;
  let small = false;

  onMount(() => {
    map.mount(mapElem, tippyElem);
  });

  // function moveView(idx: number) {
  //   if (!coords[idx]) return;
  //   const { x, y } = coords[idx];
  //   if ($store.currIdx.source !== 'map') {
  //     const view = map.getView();
  //     const currZoom = view.getZoom();
  //     if ($store.locked) {
  //       view.animate({ center: [x * mPerPx, -y * mPerPx], duration: 100, zoom: 5 });
  //     } else if (currZoom && currZoom > 2) {
  //       view.animate({ duration: 100 });
  //     }
  //   }
  //   circleFeature?.getGeometry()?.setCenter([x * mPerPx, -y * mPerPx]);
  // }

  // Move view
  // $: {
  //   if (map && coords) {
  //     const idx = $store.locked ? $store.lockedIdx : $store.currIdx;
  //     moveView(idx.idx);
  //   }
  // }

  onMount(() => {
    map.attachPointerListener({
      pointermove: oneLRU((id_: { idx: number; id: number | string } | null) => {
        $sId = { idx: id_?.idx, id: id_?.id, source: 'map' };
      })
    });
  });

  const updateSample = async (sample: Sample) => {
    await map.updateSample(sample);
    $sId = { source: 'map' };
    map = map;
  };

  // Feature change.
  $: if ($overlaysFeature[$sOverlay]) {
    updateFeature().catch(console.error);
  }
  const updateFeature = async () => {
    if (!sample) return;
    const ol = $overlays[$sOverlay];
    const fn = $overlaysFeature[$sOverlay];
    // Prevents update when state is inconsistent.
    if (!fn || isEqual(ol.currFeature, fn)) return;
    await ol.update(sample, fn);
  };

  $: if ($sEvent?.type === 'maskUpdated') {
    $overlays[$sOverlay]?.updateMask($mask);
  }

  // Hover/overlay.
  $: if ($sId && $sOverlay) changeHover($sOverlay, $sId.idx);

  let timeout: ReturnType<typeof setTimeout> | undefined;

  function hide() {
    map.persistentLayers.active.layer!.setVisible(false);
    map.tippy!.elem.style.opacity = '0';
    // map.tippy?.elem.setAttribute('hidden', '');
  }

  const changeHover = oneLRU((activeol: string, idx: number | undefined) => {
    const active = map.persistentLayers.active;
    const ov = $overlays[activeol];

    if (!ov) return false;

    if (idx != undefined && ov.coords) {
      const pos = ov.coords.pos![idx];
      if (!pos) return; // Happens when changing focus.overlay. Idx from another ol can exceed the length of current ol.
      active.layer!.setVisible(true);
      active.update(ov.coords, idx);

      if (map.tippy && pos.id) {
        if (timeout) clearTimeout(timeout);
        map.tippy.overlay.setPosition([pos.x * ov.coords.mPerPx, -pos.y * ov.coords.mPerPx]);
        map.tippy.elem.style.opacity = '1';
        // map.tippy.elem.removeAttribute('hidden');
        map.tippy.elem.innerHTML = `<code>${pos.id}<br>${$sFeatureData.data[pos.idx]}</code>`;
      }
    } else {
      timeout = setTimeout(hide, 400);
    }
  });

  $: small = width < 500;
</script>

<!-- For pane resize. -->
<svelte:body on:resize={() => map.map?.updateSize()} />

<!-- <button id="export-png" class="h-50 w-50 absolute z-50 bg-red-500 text-xl"> Meh </button> -->

<section
  class="relative h-full w-full overflow-hidden"
  bind:clientHeight={height}
  bind:clientWidth={width}
>
  <!-- Map -->
  <!-- on:mouseleave={() => ($sId = { source: 'map' })} -->
  <div
    id={mapName}
    bind:this={mapElem}
    class="map h-full w-full"
    class:small={showImgControl && small}
  />
  <!-- Map tippy -->
  <div
    bind:this={tippyElem}
    class="ol-tippy pointer-events-none max-w-sm rounded bg-neutral-800/80 px-2 py-1.5 text-xs
    backdrop-blur-lg transition-opacity duration-300 ease-out"
  />

  {#if sample}
    <!-- Img control -->
    <div
      class="absolute top-[72px] left-1 z-30 h-fit md:left-4"
      class:hidden={!showImgControl}
      style="max-width: calc(100% - 20px);"
    >
      <ImgControl background={map.persistentLayers.background} />
    </div>
  {/if}
</section>

<style lang="postcss">
  .map :global(.ol-zoomslider) {
    @apply cursor-pointer rounded bg-neutral-500/50 backdrop-blur transition-all;
  }

  .map :global(.ol-zoomslider:hover) {
    @apply bg-white/50;
  }

  .map :global(.ol-zoomslider-thumb) {
    @apply w-3;
  }

  /* .map :global(.ol-scale-line) {
    @apply absolute right-16 left-auto bottom-8 float-right w-3 bg-transparent text-right font-sans;
  }

  .map :global(.ol-scale-line-inner) {
    @apply absolute left-auto right-0 bottom-0 border-neutral-200 pb-1 text-sm text-neutral-200;
  } */

  .map :global(.ol-scale-line) {
    @apply absolute left-4 bottom-8 float-right w-3 bg-transparent text-right font-sans mix-blend-difference;
  }

  .map :global(.ol-scale-line-inner) {
    @apply absolute bottom-0 border-neutral-200 pb-1 text-sm text-neutral-200;
  }

  .map :global(.ol-zoom) {
    @apply absolute bottom-20 left-4 top-auto border-neutral-200 backdrop-blur;
  }

  .map :global(.ol-zoom-in) {
    @apply bg-slate-800/90 text-neutral-200;
  }

  .map :global(.ol-zoom-out) {
    @apply bg-slate-800/90 text-neutral-200;
  }
</style>
