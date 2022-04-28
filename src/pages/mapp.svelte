<script lang="ts">
  import type { ChunkedJSON } from '$src/lib/data/dataHandlers';
  import type { Image } from '$src/lib/data/image';
  import { colorVarFactory, type ImageCtrl, type ImageMode } from '$src/lib/mapp/imgControl';
  import ImgControl from '$src/lib/mapp/imgControl.svelte';
  import { Mapp } from '$src/lib/mapp/mapp';
  import SelectionBox from '$src/lib/mapp/selectionBox.svelte';
  import { keyOneLRU, oneLRU } from '$src/lib/utils';
  import 'ol/ol.css';
  import { onMount } from 'svelte';
  import Colorbar from '../lib/components/colorbar.svelte';
  import { activeFeatures, activeSample, samples, store } from '../lib/store';

  let image: Image;
  $: image = $samples[$activeSample].image;

  const map = new Mapp();
  let colorOpacity = 0.8;

  //   // adddapi(await fetchArrow<{ x: number; y: number }[]>(sample, 'coordsdapi'));
  // }

  let imgCtrl: ImageCtrl;
  let selecting = false;
  let selectionNames: string[] = [];

  onMount(async () => {
    map.mount();
    map.draw!.draw.on('drawend', () => (selecting = false));
    map.draw!.source.on('addfeature', () => {
      const name = prompt('Name of selection');
      map.draw!.setPolygonName(-1, name ?? '');
      console.log(map.draw?.source.getFeatures());

      updateSelectionNames();
    });

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

  const setSpotVisible = (c: boolean | null) => map.layerMap.spots.layer?.setVisible(c ?? false);
  const setOpacity = oneLRU(async (opacity: string) => {
    await map.layerMap.spots.promise;
    map.layerMap.spots.layer!.updateStyleVariables({ opacity: Number(opacity) });
  });

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

  function updateSelectionNames() {
    selectionNames = map.draw?.getPolygonsName() ?? [];
    console.log(selectionNames);
  }
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

    <section class="absolute top-16 right-4 z-20 flex flex-col items-end gap-3 md:top-4">
      <!-- Select button -->
      <div class="flex space-x-2">
        <SelectionBox
          names={selectionNames}
          on:delete={(evt) => {
            map.draw?.deletePolygon(evt.detail.i);
            updateSelectionNames();
          }}
        />
        <button
          class="rounded-lg bg-sky-600/80 px-2 py-1 text-sm text-white shadow backdrop-blur transition-all hover:bg-sky-600/80 active:bg-sky-500/80 dark:bg-sky-700/70 dark:text-slate-200 dark:hover:bg-sky-600/80"
          class:bg-slate-600={selecting}
          class:hover:bg-slate-600={selecting}
          class:active:bg-slate-600={selecting}
          on:click={() => (selecting = true)}
          disabled={selecting}
          ><svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 stroke-current stroke-2"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
      </div>

      <!-- Show all spots -->
      <div
        class="inline-flex flex-col gap-y-1 rounded-lg bg-slate-100/80 p-2 px-3 text-sm font-medium backdrop-blur-sm transition-all hover:bg-slate-200/80 dark:bg-neutral-600/70 dark:text-white/90 dark:hover:bg-neutral-600/90"
      >
        <label class="cursor-pointer">
          <input
            type="checkbox"
            class="mr-0.5 cursor-pointer opacity-80"
            checked
            on:change={(e) => setSpotVisible(e.currentTarget.checked)}
          />
          <span>Show all spots</span>
        </label>

        <input
          type="range"
          min="0"
          max="1"
          value="0.9"
          step="0.01"
          on:change={(e) => setOpacity(e.currentTarget.value)}
          on:mousemove={(e) => setOpacity(e.currentTarget.value)}
          on:mousedown={() => setSpotVisible(true)}
          class="max-w-[36rem] cursor-pointer opacity-80"
        />
      </div>

      <div class="relative mt-2">
        <Colorbar class="right-6" bind:opacity={colorOpacity} color="yellow" min={0} max={10} />
      </div>
    </section>
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
