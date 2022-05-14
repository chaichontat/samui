<script lang="ts">
  import type { Sample } from '$src/lib/data/sample';
  import { colorVarFactory, type ImageCtrl } from '$src/lib/mapp/imgControl';
  import ImgControl from '$src/lib/mapp/imgControl.svelte';
  import { Mapp } from '$src/lib/mapp/mapp';
  import { genSpotStyle } from '$src/lib/mapp/spots';
  import { keyOneLRU } from '$src/lib/utils';
  import 'ol/ol.css';
  import { createEventDispatcher, onMount } from 'svelte';
  import MapTools from '../lib/mapp/mapTools.svelte';
  import { activeFeatures, activeOverlay, store, type FeatureName } from '../lib/store';

  export let sample: Sample;
  export let trackHover = false;

  $: image = sample?.image;
  $: spots = sample?.overlays.spots;

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

  let convertImgCtrl: ReturnType<typeof colorVarFactory>;

  const update = keyOneLRU(async (sample: Sample) => {
    await sample.promise;
    const img = sample.image;
    await map.update({ image: img, spots });
    convertImgCtrl = colorVarFactory(img.mode, img.channel);

    map.layerMap['cells']?.update(sample.overlays.cells);
    updateSpot({
      key: `${sample.name}-${$activeFeatures[$activeOverlay]?.name ?? 'null'}`,
      args: [$activeOverlay, $activeFeatures[$activeOverlay]]
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
    map.layerMap.active?.update(sample.overlays[$activeOverlay], idx);
  };

  $: if (map.mounted && trackHover) changeHover($store.currIdx.idx).catch(console.error);

  let currimage: 'quantitative' | 'categorical';

  const updateSpot = keyOneLRU((ov: string, fn: FeatureName) => {
    if (!sample || !fn) return false;
    const { values, dataType } = sample.getFeature(fn);
    if (ov === 'spots' && dataType !== currimage) {
      map.layerMap[ov]?.updateStyle(
        genSpotStyle(dataType as 'quantitative' | 'categorical', spots.sizePx)
      );
      currimage = dataType as 'quantitative' | 'categorical';
    }
    map.layerMap[ov]?.updateIntensity(map, values).catch(console.error);
  });

  /// To remove $activeSample dependency since updateSpot must run after updateSample.
  function updateSpotName(fn: FeatureName) {
    if (sample) {
      updateSpot({
        key: `${sample.name}-${$activeFeatures[$activeOverlay]?.name ?? 'null'}`,
        args: [$activeOverlay, $activeFeatures[$activeOverlay]]
      });
    }
  }

  $: updateSpotName($activeFeatures[$activeOverlay]);

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
    class:composite={showImgControl && image?.mode === 'composite' && !small}
    class:rgb={showImgControl && image?.mode === 'rgb'}
  />

  {#if sample}
    <section
      class="absolute top-8 left-4 z-10 flex flex-col gap-y-2 text-lg font-medium opacity-90 lg:top-[5rem] xl:text-xl"
    >
      <!-- Spot indicator -->
      <div class="mix-blend-difference">
        Spots: <i>{@html $activeFeatures[$activeOverlay]?.name}</i>
      </div>

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
        {#if image.mode === 'composite'}
          <svelte:component
            this={ImgControl}
            mode={image.mode}
            channels={image.channel}
            bind:imgCtrl
            {small}
          />
        {:else if image.mode === 'rgb'}
          <svelte:component this={ImgControl} mode={image.mode} bind:imgCtrl {small} />
        {:else}
          {console.warn('Unknown image.mode: ' + image.mode)}
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
    @apply absolute left-auto right-4 bottom-6 top-auto backdrop-blur;
  }

  .map :global(.ol-zoom-in) {
    @apply bg-sky-700/90;
  }
  .map :global(.ol-zoom-out) {
    @apply bg-sky-700/90;
  }
</style>
