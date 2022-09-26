<script lang="ts">
  import { overlays, overlaysFeature, sId, sMapp, sOverlay } from '$lib/store';
  import type { Sample } from '$src/lib/data/objects/sample';
  import { oneLRU } from '$src/lib/lru';
  import ImgControl from '$src/lib/ui/background/imgControl.svelte';
  import MapTools from '$src/lib/ui/overlays/mapTools.svelte';
  import { isEqual } from 'lodash-es';
  import 'ol/ol.css';
  import View from 'ol/View';
  import { createEventDispatcher, onMount } from 'svelte';
  import { Mapp } from '../lib/ui/mapp';

  export let sample: Sample | undefined;
  // let currSample: string;
  $: sample?.hydrate().then(updateSample).catch(console.error);

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
  const dispatch = createEventDispatcher();

  let showImgControl = true;

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
        if (id_) $sId = { ...id_, source: 'map' };
      })
      // click: (id_: { idx: number; id: number | string } | null) => {
      //   if (!$sOverlay) return;
      //   const ov = map.layers[$sOverlay]?.overlay;
      //   if ($annotating.currKey !== null && id_ && ov) {
      //     const idx = id_.idx;
      //     const existing = map.persistentLayers.annotations.get(idx);
      //     if (
      //       existing === null ||
      //       existing.get('value') !== $annotating.keys[$annotating.currKey]
      //     ) {
      //       map.persistentLayers.annotations.add(
      //         idx,
      //         $annotating.keys[$annotating.currKey],
      //         ov,
      //         $annotating.keys
      //       );
      //     } else {
      //       map.persistentLayers.annotations.delete(idx);
      //     }
      //   }
      // }
    });
  });

  const updateSample = async (sample: Sample) => {
    await map.updateSample(sample);
    map = map;

    // } else {
    // When adding outlines in app.
    // await map.update({ sample, overlays: $overlays, refresh: true });
    // }
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

  // Hover/overlay.
  $: if ($sId && $sOverlay) changeHover($sOverlay, $sId.idx);

  const changeHover = oneLRU((activeol: string, idx: number | null) => {
    const active = map.persistentLayers.active;
    const ov = $overlays[activeol];

    if (!ov) return false;

    if (idx !== null && ov.coords) {
      active.layer!.setVisible(true);
      const pos = ov.coords.pos![idx];
      if (!pos) return; // Happens when changing focus.overlay. Idx from another ol can exceed the length of current ol.
      active.update(ov.coords, idx);
      if (map.tippy && pos.id) {
        map.tippy.overlay.setPosition([pos.x * ov.coords.mPerPx, -pos.y * ov.coords.mPerPx]);
        map.tippy.elem.removeAttribute('hidden');
        map.tippy.elem.innerHTML = `<code>${pos.id}</code>`;
      }
    } else {
      active.layer!.setVisible(false);
      map.tippy?.elem.setAttribute('hidden', '');
    }
  });

  $: small = width < 500;
</script>

<!-- For pane resize. -->
<svelte:body on:resize={() => map.map?.updateSize()} />

<!-- <button
  class="h-50 w-50 absolute z-50 bg-red-500 text-xl"
  on:click={() => console.log(map.map?.getView())}
>
  Meh
</button> -->

<section
  class="relative h-full w-full overflow-hidden"
  bind:clientHeight={height}
  bind:clientWidth={width}
>
  <!-- Map -->
  <div
    id={mapName}
    bind:this={mapElem}
    on:click={() => dispatch('mapClick')}
    class="map h-full w-full shadow-lg"
    class:small={showImgControl && small}
  />
  <!-- Map tippy -->
  <div
    bind:this={tippyElem}
    class="ol-tippy pointer-events-none max-w-sm rounded bg-slate-800/60 p-2 text-xs backdrop-blur-lg"
  />

  {#if sample}
    <!-- Overlay and Colorbar -->
    <MapTools {map} {width} bind:showImgControl />

    <!-- Img control -->
    <div
      class="absolute top-[72px] left-1 lg:left-4 lg:bottom-6"
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
    @apply absolute left-4 bottom-8 float-right w-3 bg-transparent text-right font-sans;
  }

  .map :global(.ol-scale-line-inner) {
    @apply absolute  bottom-0 border-neutral-200 pb-1 text-sm text-neutral-200;
  }

  .map :global(.ol-zoom) {
    @apply absolute bottom-20 left-4 top-auto border-neutral-200 backdrop-blur;
  }

  .map :global(.ol-zoom-in) {
    @apply bg-sky-600/90 text-neutral-200;
  }

  .map :global(.ol-zoom-out) {
    @apply bg-sky-600/90 text-neutral-200;
  }
</style>
