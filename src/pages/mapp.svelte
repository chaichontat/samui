<script lang="ts">
  import type { FeatureAndGroup } from '$lib/data/features';
  import type { Sample } from '$src/lib/data/sample';
  import { colorVarFactory, type ImageCtrl } from '$src/lib/mapp/imgControl';
  import ImgControl from '$src/lib/mapp/imgControl.svelte';
  import { Mapp } from '$src/lib/mapp/mapp';
  import { keyOneLRU, oneLRU } from '$src/lib/utils';
  import 'ol/ol.css';
  import { createEventDispatcher, onMount } from 'svelte';
  import MapTools from '../lib/mapp/mapTools.svelte';
  import { annotating, sFeature, sId, sOverlay } from '../lib/store';

  export let sample: Sample | undefined;
  $: sample?.hydrate().catch(console.error);

  $: image = sample?.image;

  export let uid: number;
  const mapName = `map-${uid}`;
  let mapElem: HTMLDivElement;
  let tippyElem: HTMLDivElement;
  const map = new Mapp();

  let width: number;
  let height: number;
  let small = false;
  const dispatch = createEventDispatcher();

  let imgCtrl: ImageCtrl;
  let showImgControl = true;

  onMount(() => {
    map.mount(mapElem, tippyElem);
    map.attachPointerListener({
      pointermove: oneLRU((id_: { idx: number; id: number | string } | null) => {
        if (id_) $sId = { ...id_, source: 'map' };
      }),

      click: (id_: { idx: number; id: number | string } | null) => {
        if (!$sOverlay) return;
        const ov = map.layers[$sOverlay]?.overlay;
        if ($annotating.currKey && id_ && ov) {
          const idx = id_.idx;
          const existing = map.persistentLayers.annotations.get(idx);
          if (
            existing === null ||
            existing.get('value') !== $annotating.keys[$annotating.currKey]
          ) {
            map.persistentLayers.annotations.add(
              idx,
              $annotating.keys[$annotating.currKey],
              ov,
              $annotating.keys
            );
          } else {
            map.persistentLayers.annotations.delete(idx);
          }
          $annotating.spots = map.persistentLayers.annotations.dump();
        }
      }
    });
  });

  $: map.persistentLayers.annotations.layer?.setVisible($annotating.show);

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

  // Sample change.
  let convertImgCtrl: ReturnType<typeof colorVarFactory>;
  $: if (sample) update({ key: sample.name, args: [sample] }).catch(console.error);
  const update = keyOneLRU(async (sample: Sample) => {
    await sample.promise;
    const img = sample.image;
    await map.update({ image: img, overlays: sample.overlays });
    convertImgCtrl = colorVarFactory(img.channel);
  });

  // Feature change.
  $: if (sample && $sOverlay && $sFeature[$sOverlay]) {
    console.log($sFeature[$sOverlay]);

    const ol = $sOverlay;
    updateFeature({
      key: `${sample.name}-${ol}-${$sFeature[ol].group}-${$sFeature[ol].feature}`,
      args: [ol, $sFeature[ol]]
    }).catch(console.error);
  }
  const updateFeature = keyOneLRU(async (ov: string, fn: FeatureAndGroup) => {
    const res = await sample!.overlays[ov].getFeature(fn);
    if (!res) return false;
    map.layers[ov]?.updateProperties(res);
  });

  // Hover/overlay.
  $: if (sample && $sOverlay) changeHover($sOverlay, $sId.idx).catch(console.error);

  const changeHover = oneLRU(async (activeol: string, idx: number | null) => {
    await sample!.promise;
    const active = map.persistentLayers.active;
    const ov = sample!.overlays[activeol];

    if (!ov) return false;

    if (idx !== null) {
      active.layer!.setVisible(true);
      const pos = ov.pos![idx];
      if (!pos) return; // Happens when changing focus.overlay. Idx from another ol can exceed the length of current ol.
      active.update(sample!.overlays[activeol], idx);
      if (map.tippy && pos.id) {
        map.tippy.overlay.setPosition([pos.x * ov.mPerPx!, -pos.y * ov.mPerPx!]);
        map.tippy.elem.removeAttribute('hidden');
        map.tippy.elem.innerHTML = `<code>${pos.id}</code>`;
      }
    } else {
      active.layer!.setVisible(false);
      map.tippy?.elem.setAttribute('hidden', '');
    }
  });

  // Image control params
  $: if (convertImgCtrl && imgCtrl) {
    map.persistentLayers.background?.updateStyle(convertImgCtrl(imgCtrl));
  }

  $: small = width < 500;
</script>

<!-- For pane resize. -->
<svelte:body on:resize={() => map.map?.updateSize()} />

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
    class:composite={showImgControl && image?.channel !== 'rgb' && !small}
    class:rgb={showImgControl && image?.channel === 'rgb'}
  />
  <!-- Map tippy -->
  <div
    bind:this={tippyElem}
    class="ol-tippy pointer-events-none max-w-sm rounded bg-slate-800/60 p-2 text-xs backdrop-blur-lg"
  />

  {#if sample}
    <section
      class="absolute top-8 left-4 z-10 flex flex-col gap-y-2 text-lg font-medium opacity-90 lg:top-[5rem] xl:text-xl"
    >
      <!-- Color indicator -->
      <div class="flex flex-col">
        {#each ['text-blue-600', 'text-green-600', 'text-red-600'] as color, i}
          {#if imgCtrl?.type === 'composite' && imgCtrl.showing[i] !== 'None'}
            <span class={`font-semibold ${color}`}>{imgCtrl.showing[i]}</span>
          {/if}
        {/each}
      </div>
    </section>

    <MapTools {sample} {map} {width} bind:showImgControl />
  {/if}

  <!-- Buttons -->
  {#if sample}
    <div
      class="absolute bottom-3 left-1 lg:left-4 lg:bottom-6 xl:pr-4"
      style="max-width: calc(100% - 20px);"
    >
      <div
        class="flex flex-col overflow-x-auto rounded-lg bg-slate-200/80 p-2 pr-4 font-medium backdrop-blur-lg transition-colors dark:bg-slate-800/80 "
        class:hidden={!showImgControl}
      >
        {#if image?.channel !== 'rgb'}
          <svelte:component this={ImgControl} channels={image?.channel} bind:imgCtrl {small} />
        {:else}
          <svelte:component this={ImgControl} bind:imgCtrl {small} />
        {/if}
      </div>
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

  .map :global(.ol-scale-line) {
    @apply left-6 bottom-4 float-right w-3 bg-transparent text-right font-sans;
  }

  .small :global(.ol-scale-line) {
    @apply bottom-[8.5rem];
  }

  .rgb :global(.ol-scale-line) {
    @apply bottom-36;
  }

  .composite :global(.ol-scale-line) {
    @apply bottom-[9.5rem];
  }

  .map :global(.ol-scale-line-inner) {
    @apply pb-1 text-sm;
  }

  .map :global(.ol-zoom) {
    @apply absolute bottom-[5.5rem] left-auto right-4 top-auto backdrop-blur;
  }

  .map :global(.ol-zoom-in) {
    @apply bg-sky-700/90;
  }

  .map :global(.ol-zoom-out) {
    @apply bg-sky-700/90;
  }
</style>
