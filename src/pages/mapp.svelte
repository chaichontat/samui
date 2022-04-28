<script lang="ts">
  import type { ChunkedJSON } from '$src/lib/data/dataHandlers';
  import type { Image } from '$src/lib/data/image';
  import { colorVarFactory, type ImageCtrl, type ImageMode } from '$src/lib/mapp/imgControl';
  import ImgControl from '$src/lib/mapp/imgControl.svelte';
  import { Mapp } from '$src/lib/mapp/mapp';
  import { keyOneLRU } from '$src/lib/utils';
  import 'ol/ol.css';
  import { onMount } from 'svelte';
  import { activeFeatures, activeSample, samples, store } from '../lib/store';
  import MapTools from './mapTools.svelte';

  let image: Image;
  $: image = $samples[$activeSample].image;

  const map = new Mapp();

  //   // adddapi(await fetchArrow<{ x: number; y: number }[]>(sample, 'coordsdapi'));
  // }

  let imgCtrl: ImageCtrl;
  let selecting = false;

  onMount(async () => {
    map.mount();

    map.handlePointer({
      pointermove: (idx: number) => ($store.currIdx = { idx, source: 'map' })
    });
    await update(image).catch(console.error);

    // const dapiLayer = new WebGLPointsLayer({
    //   // @ts-expect-error
    //   source: dapi,
    //   style: {
    //     symbol: {
    //       symbolType: 'square',
    //       size: 4,
    //       color: '#ffffff',
    //       opacity: 0.5
    //     }
    //   },
    //   minZoom: 4
    // });
    // update($activeSample).catch(console.error);
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

  // Enable/disable polygon draw
  $: if (map.map && map.draw) {
    if (selecting) {
      map.map?.addInteraction(map.draw.draw);
      map.map.getViewport().style.cursor = 'crosshair';
    } else {
      map.map.removeInteraction(map.draw.draw);
      map.map.getViewport().style.cursor = 'grab';
    }
  }

  let mode: ImageMode;
  let convertImgCtrl: ReturnType<typeof colorVarFactory>;
  const update = async (img: Image) => {
    await map.update({ image });
    mode = img.header!.mode ?? 'composite';
    convertImgCtrl = colorVarFactory(mode, img.channel);
    console.log(`${$activeSample}${$activeFeatures.genes.active ?? 'null'}`);

    updateSpot({
      key: `${$activeSample}${$activeFeatures.genes.active ?? 'null'}`,
      args: [$activeFeatures.genes.active]
    });
    // updateSpot({ key: 'GFAP', args: [$activeFeatures.genes.active] });
  };

  $: update(image).catch(console.error);
  $: if (convertImgCtrl && imgCtrl) {
    map.layerMap.background.updateStyle(convertImgCtrl(imgCtrl));
  }

  const changeHover = async (idx: number) => {
    await image.promise;
    map.layerMap.active.update(image.coords![idx], image.header!.spot);
  };

  $: if (map.mounted) changeHover($store.currIdx.idx).catch(console.error);

  const updateSpot = keyOneLRU((name: string | null) => {
    if (name === null) return false;
    const x = ($samples[$activeSample].features.genes as ChunkedJSON).retrieve!(name) as Promise<
      number[]
    >;

    map.layerMap.spots.updateIntensity(map, x).catch(console.error);
  });

  /// To remove $activeSample dependency since updateSpot must run after updateSample.
  function updateSpotName(name: string | null) {
    updateSpot({
      key: `${$activeSample}${name ?? 'null'}`,
      args: [$activeFeatures.genes.active]
    });
  }

  $: updateSpotName($activeFeatures.genes.active);
</script>

<!-- For pane resize. -->
<svelte:body on:resize={() => map.map?.updateSize()} />

<section class="relative h-full w-full">
  <!-- Map -->
  <div
    id="map"
    class="h-full w-full shadow-lg"
    class:rgbmode={image.header?.mode === 'rgb'}
    class:compositemode={image.header?.mode === 'composite'}
  >
    <section
      class="absolute left-4 top-16 z-10 text-lg font-medium opacity-90 lg:top-[5.5rem] xl:text-xl"
    >
      <!-- Spot indicator -->
      <div class="mix-blend-difference">Spots: <i>{@html $activeFeatures.genes.active}</i></div>

      <!-- Color indicator -->
      <div class="mt-2 flex flex-col">
        {#each ['text-blue-600', 'text-green-600', 'text-red-600'] as color, i}
          {#if imgCtrl?.type === 'composite' && imgCtrl.showing[i] !== 'None'}
            <span class={`font-semibold ${color}`}>{imgCtrl.showing[i]}</span>
          {/if}
        {/each}
      </div>
    </section>

    <MapTools {map} bind:selecting />
  </div>

  <!-- Buttons -->
  <div
    class="absolute bottom-3 flex max-w-[48rem] flex-col rounded-lg bg-slate-200/80 p-2 font-medium backdrop-blur transition-colors dark:bg-slate-800/70 lg:bottom-6 lg:left-4 xl:pr-4"
  >
    {#if mode === 'composite'}
      <svelte:component this={ImgControl} {mode} channels={image.channel} bind:imgCtrl />
    {:else if mode === 'rgb'}
      <svelte:component this={ImgControl} {mode} bind:imgCtrl />
    {:else}
      {console.warn('Unknown mode: ' + mode)}
    {/if}
  </div>
</section>

<style lang="postcss">
  #map :global(.ol-zoomslider) {
    @apply cursor-pointer rounded bg-neutral-500/50 backdrop-blur transition-all;
  }

  #map :global(.ol-zoomslider:hover) {
    @apply bg-white/50;
  }

  #map :global(.ol-zoomslider-thumb) {
    @apply w-3;
  }

  #map :global(.ol-scale-line) {
    @apply left-6 float-right w-3  bg-transparent text-right font-sans;
  }

  .rgbmode :global(.ol-scale-line) {
    @apply bottom-36;
  }

  .compositemode :global(.ol-scale-line) {
    @apply bottom-48;
  }

  #map :global(.ol-scale-line-inner) {
    @apply pb-1 text-sm;
  }

  #map :global(.ol-zoom) {
    @apply absolute left-auto right-4 bottom-6 top-auto;
  }
</style>
