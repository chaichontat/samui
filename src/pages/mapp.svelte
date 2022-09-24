<script lang="ts">
  import { sMapp } from '$lib/store';
  import type { Sample } from '$src/lib/data/objects/sample';
  import ImgControl from '$src/lib/ui/background/imgControl.svelte';
  import 'ol/ol.css';
  import View from 'ol/View';
  import { createEventDispatcher, onMount } from 'svelte';
  import { Mapp } from '../lib/ui/mapp';

  export let sample: Sample | undefined;
  $: sample?.hydrate().catch(console.error);
  let currSample = sample?.name;

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

  // Sample change.
  $: if (sample) update(sample).catch(console.error);
  const update = async (sample: Sample) => {
    if (currSample !== sample.name) {
      await map.updateSample(sample);
      currSample = sample.name;
      map = map;
    } else {
      // When adding outlines in app.
      // await map.update({ sample, overlays: $overlays, refresh: true });
    }

    // for (const [name, ol] of Object.entries($overlays)) {
    //   updateFeature({
    //     key: `${sample.name}-${$sFeature[name].group}-${$sFeature[name].feature}`,
    //     args: [$sFeature[name]]
    //   }).catch(console.error);
    // }
  };

  // Feature change.
  // $: if (sample && $sOverlay && $sFeature[$sOverlay]) {
  //   const ol = $sOverlay;
  //   updateFeature({
  //     key: `${sample.name}-${$sFeature[ol].group}-${$sFeature[ol].feature}`,
  //     args: [$sFeature[ol]]
  //   }).catch(console.error);
  // }

  // const genCoords = keyLRU((name: string, pos: Record<string, number>[], mPerPx: number) => {
  //   return new CoordsData({
  //     name,
  //     shape: 'circle',
  //     pos,
  //     mPerPx
  //   });
  // });

  // const updateFeature = keyOneLRU(async (fn: FeatureAndGroup) => {
  //   if (!fn.feature) return false;
  //   const res = await sample!.getFeature(fn);
  //   if (!res) return false;

  //   const mPerPx = res.mPerPx ?? sample?.image?.mPerPx;
  //   if (mPerPx == undefined) {
  //     console.error(`mPerPx is undefined at ${fn.feature}.`);
  //     return false;
  //   }

  //   if (res.coordName) {
  //     $overlays[$sOverlay].update(sample!.coords[res.coordName]);
  //   } else {
  //     if (!('x' in res.data[0]) || !('y' in res.data[0])) {
  //       console.error("Feature doesn't have x or y.");
  //       return false;
  //     }
  //     $overlays[$sOverlay].update(
  //       genCoords({
  //         key: `${sample!.name}-${fn.group}-${fn.feature}`,
  //         args: [fn.feature, res.data, mPerPx]
  //       })
  //     );
  //   }

  //   $overlays[$sOverlay]?.updateProperties(res);
  //   if (!map.map?.getView().getCenter()) {
  //     let mx = 0;
  //     let my = 0;
  //     let max = [0, 0];
  //     for (const { x, y } of res.data) {
  //       mx += Number(x);
  //       my += Number(y);
  //       max[0] = Math.max(max[0], Number(x));
  //       max[1] = Math.max(max[1], Number(y));
  //     }
  //     mx /= res.data.length;
  //     my /= res.data.length;
  //     console.log(res.data, mx, my);

  //     // TODO: Deal with hard-coded zoom.
  //     map.map?.setView(
  //       new View({
  //         center: [mx * mPerPx, -my * mPerPx],
  //         projection: 'EPSG:3857',
  //         resolution: 1e-4,
  //         minResolution: 1e-7,
  //         maxResolution: Math.max(max[0], max[1]) * mPerPx
  //       })
  //     );
  //   }
  // });

  // Hover/overlay.
  // $: if (sample && $sOverlay) changeHover($sOverlay, $sId.idx).catch(console.error);

  // const changeHover = oneLRU(async (activeol: string, idx: number | null) => {
  //   await sample!.promise;
  //   const active = map.persistentLayers.active;
  //   const ov = $overlays[activeol];

  //   if (!ov) return false;

  //   if (idx !== null && ov.coords) {
  //     active.layer!.setVisible(true);
  //     const pos = ov.coords.pos![idx];
  //     if (!pos) return; // Happens when changing focus.overlay. Idx from another ol can exceed the length of current ol.
  //     active.update(ov.coords, idx);
  //     if (map.tippy && pos.id) {
  //       map.tippy.overlay.setPosition([pos.x * ov.coords.mPerPx, -pos.y * ov.coords.mPerPx]);
  //       map.tippy.elem.removeAttribute('hidden');
  //       map.tippy.elem.innerHTML = `<code>${pos.id}</code>`;
  //     }
  //   } else {
  //     active.layer!.setVisible(false);
  //     map.tippy?.elem.setAttribute('hidden', '');
  //   }
  // });

  $: small = width < 500;
</script>

<!-- For pane resize. -->
<svelte:body on:resize={() => map.map?.updateSize()} />
<button
  class="h-50 w-50 absolute z-50 bg-red-500 text-xl"
  on:click={() => console.log(map.map?.getView())}
>
  Meh
</button>

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
  />
  <!-- class:small={showImgControl && small}
    class:composite={showImgControl && sample?.image?.mode !== 'rgb' && !small}
    class:rgb={showImgControl && sample?.image?.mode === 'rgb'} -->
  <!-- Map tippy -->
  <div
    bind:this={tippyElem}
    class="ol-tippy pointer-events-none max-w-sm rounded bg-slate-800/60 p-2 text-xs backdrop-blur-lg"
  />

  <!-- Channel indicator -->
  {#if sample}
    <!-- Top right tools -->
    <!-- <MapTools {map} {width} bind:showImgControl /> -->

    <!-- Img control -->
    <div
      class="absolute top-[72px] left-1 lg:left-4 lg:bottom-6"
      class:hidden={!showImgControl}
      style="max-width: calc(100% - 20px);"
    >
      {#if map.persistentLayers.background.image?.channels}
        <ImgControl background={map.persistentLayers.background} />
      {/if}
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
    @apply left-8 bottom-8 float-right w-3 bg-transparent text-right font-sans;
  }

  .map :global(.ol-scale-line-inner) {
    @apply border-neutral-200 pb-1 text-sm text-neutral-200;
  }

  .map :global(.ol-zoom) {
    @apply absolute bottom-8 left-auto right-6 top-auto border-neutral-200 backdrop-blur;
  }

  .map :global(.ol-zoom-in) {
    @apply bg-sky-600/90 text-neutral-200;
  }

  .map :global(.ol-zoom-out) {
    @apply bg-sky-600/90 text-neutral-200;
  }
</style>
