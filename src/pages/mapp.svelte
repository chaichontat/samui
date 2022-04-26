<script lang="ts">
  import type { Image } from '$src/lib/data/image';
  import { colorVarFactory, type ImageCtrl, type ImageMode } from '$src/lib/mapp/imgControl';
  import ImgControl from '$src/lib/mapp/imgControl.svelte';
  import { Mapp } from '$src/lib/mapp/mapp';
  import 'ol/ol.css';
  import { onMount } from 'svelte';
  import Colorbar from '../lib/components/colorbar.svelte';
  import { activeSample, currRna, samples, store } from '../lib/store';

  let selecting = false;

  export let image: Image;
  // export let spotIntensity: { name: string; value: number[] | Promise<number[]> };
  let currHover = 0;
  const map = new Mapp();

  let colorOpacity = 0.8;

  // async function update({img, intensity} , {img?: Image, intensity?: number[] | Promise<number[]>}) => {
  //   coords = image.coords!;
  //   proteinMap = image.channel!;

  //   if (Object.keys(proteinMap) !== proteins) {
  //     proteins = Object.keys(proteinMap);
  //   }

  //   if (mode !== (image.header?.mode ?? 'composite')) {
  //     mode = image.header?.mode ?? 'composite';
  //     getColorParams = colorVarFactory(mode, proteinMap);

  //     if (mode === 'composite') {
  //       imgCtrl = {
  //         type: 'composite',
  //         showing: proteins.slice(0, 3),
  //         maxIntensity: [128, 128, 128]
  //       };
  //     } else {
  //       imgCtrl = { type: 'rgb', Exposure: 0, Contrast: 0, Saturation: 0 };
  //     }
  //     bgLayer.setStyle(genBgStyle(mode));
  //   }

  //   const urls = image.urls.map((url) => ({ url: url.url }));
  //   sourceTiff = new GeoTIFF({
  //     normalize: image.header!.mode === 'rgb',
  //     sources: urls
  //   });

  //   mPerPx = image.header!.spot.mPerPx;

  //   // Refresh spots
  //   const previousLayer = spotsLayer;
  //   spotsSource.clear();
  //   spotsLayer = new WebGLPointsLayer({
  //     // @ts-expect-error
  //     source: spotsSource,
  //     style: genStyle(image.header!.spot.spotDiam / mPerPx)
  //   });
  //   map.addLayer(spotsLayer);
  //   if (previousLayer) {
  //     map.removeLayer(previousLayer);
  //     previousLayer.dispose();
  //   }
  //   addData(coords, mPerPx);
  //   updateSpots($currRna);

  //   // Refresh select
  //   draw.updateSample(spotsSource.getFeatures());

  //   // Refresh background
  //   bgLayer.getSource()?.dispose();
  //   bgLayer.setSource(sourceTiff);
  //   map.setView(sourceTiff.getView());

  //   mPerPx = image.header!.spot.mPerPx;
  //   currSample = sample.name;

  //   bgLayer?.updateStyleVariables(getColorParams(imgCtrl));

  //   // adddapi(await fetchArrow<{ x: number; y: number }[]>(sample, 'coordsdapi'));
  // }

  let imgCtrl: ImageCtrl;

  onMount(async () => {
    map.mount();
    await map.update({ image }).catch(console.error);
    map.draw!.draw.on('drawend', () => (selecting = false));
    map.handlePointer({
      pointermove: (id: number) => (currHover = id)
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

  // Update "brightness"
  // $: if (getColorParams && imgCtrl?.type === mode)
  //   bgLayer?.updateStyleVariables(getColorParams(imgCtrl));
  // $: spotsLayer?.updateStyleVariables({ opacity: colorOpacity });

  // function updateSpots(rna: { name: string; values: number[] }) {
  //   for (let i = 0; i < coords.length; i++) {
  //     spotsLayer
  //       .getSource()!
  //       .getFeatureById(i)
  //       ?.setProperties({ value: rna.values[i] ?? 0 });
  //   }
  // }
  // // Change spot color
  // $: if (spotsLayer && coords) {
  //   updateSpots($currRna);
  // }

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

  const setSpotVisible = (c: boolean) => map.layerMap.spots.layer?.setVisible(c);
  const setOpacity = async (opacity: string) => {
    await map.layerMap.spots.promise;
    map.layerMap.spots.layer!.updateStyleVariables({ opacity: Number(opacity) });
  };

  let mode: ImageMode;
  let convertImgCtrl: ReturnType<typeof colorVarFactory>;
  const update = async (img: Image) => {
    await img.promise;
    mode = img.header?.mode ?? 'composite';
    convertImgCtrl = colorVarFactory(mode, img.channel);
  };

  $: update(image).catch(console.error);
  $: if (convertImgCtrl && imgCtrl) {
    map.layerMap.background.updateStyle(convertImgCtrl(imgCtrl));
  }

  const changeHover = async (idx: number) => {
    await image.promise;
    map.layerMap.active.change(image.coords![idx], image.header!.spot);
  };

  $: if (map.mounted) changeHover(currHover).catch(console.error);
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
    <div
      class="absolute left-4 top-16 z-10 text-lg font-medium opacity-90 lg:top-[5.5rem] xl:text-xl"
    >
      <!-- Spot indicator -->
      <div class="mix-blend-difference">Spots: <i>{@html $currRna.name}</i></div>

      <!-- Color indicator -->
      <div class="mt-2 flex flex-col">
        {#each ['text-blue-600', 'text-green-600', 'text-red-600'] as color, i}
          {#if imgCtrl?.type === 'composite' && imgCtrl.showing[i] !== 'None'}
            <span class={`font-semibold ${color}`}>{imgCtrl.showing[i]}</span>
          {/if}
        {/each}
      </div>
    </div>

    <div class="absolute top-16 right-4 z-20 flex flex-col items-end gap-3 md:top-4">
      <!-- Show all spots -->
      <div
        class="inline-flex flex-col gap-y-1 rounded-lg bg-slate-100/80 p-2 px-3 text-sm font-medium backdrop-blur-sm transition-all hover:bg-slate-200/80 dark:bg-neutral-600/70 dark:text-white/90 dark:hover:bg-neutral-600/90"
      >
        <label class="cursor-pointer">
          <input
            type="checkbox"
            class="mr-0.5 cursor-pointer opacity-80"
            checked
            on:change={(e) => setSpotVisible(e.target.checked)}
          />
          <span>Show all spots</span>
        </label>

        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          on:change={(e) => setOpacity(e.target.value)}
          on:mousedown={() => setSpotVisible(true)}
          class="max-w-[36rem] cursor-pointer opacity-80"
        />
      </div>

      <!-- Select button -->
      <div class="flex space-x-2">
        <button
          class="rounded bg-sky-600/80 px-2 py-1 text-sm text-white shadow backdrop-blur transition-all hover:bg-sky-600/80 active:bg-sky-500/80 dark:bg-sky-700/70 dark:text-slate-200"
          class:bg-slate-600={selecting}
          class:hover:bg-slate-600={selecting}
          class:active:bg-slate-600={selecting}
          on:click={() => (selecting = true)}
          disabled={selecting}
          >Select
        </button>

        <button
          class="rounded bg-orange-600/80 px-2 py-1 text-sm text-white shadow backdrop-blur transition-all hover:bg-orange-600/80 active:bg-orange-500/80 dark:bg-orange-700/70 dark:text-slate-200"
          on:click={() => map.draw?.clear()}
          disabled={selecting}
          >Clear
        </button>
      </div>

      <div class="relative mt-2">
        <Colorbar class="right-6" bind:opacity={colorOpacity} color="yellow" min={0} max={10} />
      </div>
    </div>
  </div>

  <!-- Buttons -->
  <div
    class="absolute bottom-3 flex max-w-[48rem] flex-col rounded-lg bg-slate-200/80 p-2 font-medium backdrop-blur transition-colors dark:bg-slate-800/70 lg:bottom-6 lg:left-4 xl:pr-4"
  >
    {#if mode === 'composite'}
      <svelte:component this={ImgControl} {mode} channels={image.channel} bind:imgCtrl />
    {:else if mode === 'rgb'}
      <svelte:component this={ImgControl} {mode} bind:imgCtrl />
    {:else if mode === undefined}{:else}
      {console.error('Unknown mode: ' + mode)}
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
