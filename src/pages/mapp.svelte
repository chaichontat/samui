<script lang="ts">
  import type { Sample } from '$src/lib/data/sample';
  import { colorVarFactory, type ImageCtrl, type ImageMode } from '$src/lib/mapp/imgControl';
  import ImgControl from '$src/lib/mapp/imgControl.svelte';
  import { Mapp } from '$src/lib/mapp/mapp';
  import { keyOneLRU } from '$src/lib/utils';
  import 'ol/ol.css';
  import { createEventDispatcher, onMount } from 'svelte';
  import MapTools from '../lib/mapp/mapTools.svelte';
  import { activeFeatures, store, type FeatureName } from '../lib/store';

  export let sample: Sample;
  export let trackHover = false;

  $: image = sample?.image;

  export let uid: number;
  const mapName = `map-${uid}`;
  const map = new Mapp();

  let width: number;
  let height: number;
  let small = false;
  const dispatch = createEventDispatcher();

  //   // adddapi(await fetchArrow<{ x: number; y: number }[]>(sample, 'coordsdapi'));
  // }

  let imgCtrl: ImageCtrl;
  let selecting = false;
  let showImgControl = true;

  onMount(() => {
    map.mount(mapName);
    map.handlePointer({
      pointermove: (idx: number) => {
        if (trackHover) $store.currIdx = { idx, source: 'map' };
      }
    });

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

  const update = keyOneLRU(async (sample: Sample) => {
    await sample.promise;
    const img = sample.image;
    await map.update({ image: img });
    mode = img.header!.mode ?? 'composite';
    convertImgCtrl = colorVarFactory(mode, img.channel);

    updateSpot({
      key: `${sample.name}-${$activeFeatures.name ?? 'null'}`,
      args: [$activeFeatures]
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  $: if (sample) update({ key: sample.name, args: [sample] });

  $: if (convertImgCtrl && imgCtrl) {
    map.layerMap.background?.updateStyle(convertImgCtrl(imgCtrl));
  }

  const changeHover = async (idx: number) => {
    if (!image) return;
    await image.promise;
    map.layerMap.active?.update(image.coords![idx], image.header!.spot);
  };

  $: if (map.mounted && trackHover) changeHover($store.currIdx.idx).catch(console.error);

  const updateSpot = keyOneLRU((fn: FeatureName) => {
    if (!sample || !fn) return false;
    const { values, dataType } = sample.getFeature(fn);
    map.layerMap.spots?.updateIntensity(map, values, dataType).catch(console.error);
  });

  /// To remove $activeSample dependency since updateSpot must run after updateSample.
  function updateSpotName(fn: FeatureName) {
    if (sample) {
      updateSpot({
        key: `${sample.name}${JSON.stringify(fn)} ?? 'null'}`,
        args: [$activeFeatures]
      });
    }
  }

  $: updateSpotName($activeFeatures);

  $: small = width < 500;
</script>

<!-- For pane resize. -->
<svelte:body on:resize={() => map.map?.updateSize()} />

<section class="relative h-full w-full" bind:clientHeight={height} bind:clientWidth={width}>
  <!-- Map -->
  <div
    id={mapName}
    on:click={() => dispatch('mapClick')}
    class="map h-full w-full shadow-lg"
    class:small={showImgControl && small}
    class:compositemode={showImgControl && image?.header?.mode === 'composite' && !small}
    class:rgbmode={showImgControl && image?.header?.mode === 'rgb'}
  />

  {#if sample}
    <section
      class="absolute top-8 left-4 z-10 flex flex-col gap-y-2 text-lg font-medium opacity-90 lg:top-[5rem] xl:text-xl"
    >
      <!-- Spot indicator -->
      <div class="mix-blend-difference">Spots: <i>{@html $activeFeatures?.name}</i></div>

      <!-- Color indicator -->
      <div class="flex flex-col">
        {#each ['text-blue-600', 'text-green-600', 'text-red-600'] as color, i}
          {#if imgCtrl?.type === 'composite' && imgCtrl.showing[i] !== 'None'}
            <span class={`font-semibold ${color}`}>{imgCtrl.showing[i]}</span>
          {/if}
        {/each}
      </div>
    </section>

    <MapTools {map} {width} bind:selecting bind:showImgControl />
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
        {#if mode === 'composite'}
          <svelte:component
            this={ImgControl}
            {mode}
            channels={image.channel}
            bind:imgCtrl
            {small}
          />
        {:else if mode === 'rgb'}
          <svelte:component this={ImgControl} {mode} bind:imgCtrl {small} />
        {:else}
          {console.warn('Unknown mode: ' + mode)}
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

  .rgbmode :global(.ol-scale-line) {
    @apply bottom-36;
  }

  .compositemode :global(.ol-scale-line) {
    @apply bottom-[9.5rem];
  }

  .map :global(.ol-scale-line-inner) {
    @apply pb-1 text-sm;
  }

  .map :global(.ol-zoom) {
    @apply absolute left-auto right-4 bottom-6 top-auto backdrop-blur;
  }

  .map :global(.ol-zoom-in) {
    @apply bg-sky-700/90;
  }
  .map :global(.ol-zoom-out) {
    @apply bg-sky-700/90;
  }
</style>
