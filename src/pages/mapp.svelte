<script lang="ts">
  import promise from '$lib/meh';
  import type { Sample } from '$src/lib/data/sample';
  import { colorVarFactory, genBgStyle } from '$src/lib/mapp/background';
  import type { ImageCtrl, ImageMode } from '$src/lib/mapp/imgControl';
  import ImgControl from '$src/lib/mapp/imgControl.svelte';
  import { genStyle, getCanvasCircle, getWebGLCircles } from '$src/lib/mapp/spots';
  import ScaleLine from 'ol/control/ScaleLine.js';
  import Zoom from 'ol/control/Zoom.js';
  import type Feature from 'ol/Feature';
  import type { Circle, Geometry } from 'ol/geom.js';
  import type { Draw } from 'ol/interaction.js';
  import type VectorLayer from 'ol/layer/Vector';
  import WebGLPointsLayer from 'ol/layer/WebGLPoints.js';
  import type TileLayer from 'ol/layer/WebGLTile';
  import WebGLTileLayer from 'ol/layer/WebGLTile';
  import Map from 'ol/Map.js';
  import 'ol/ol.css';
  import GeoTIFF from 'ol/source/GeoTIFF.js';
  import type VectorSource from 'ol/source/Vector.js';
  import { Stroke, Style } from 'ol/style.js';
  import { onMount } from 'svelte';
  import Colorbar from '../lib/components/colorbar.svelte';
  import { select } from '../lib/mapp/selector';
  import { activeSample, currRna, samples, store } from '../lib/store';

  let mode: ImageMode;
  let elem: HTMLDivElement;
  let selecting = false;
  let coords: { x: number; y: number }[];
  let proteinMap: Record<string, number>;
  let proteins = ['', '', ''];
  let getColorParams: ReturnType<typeof colorVarFactory>;
  let mPerPx: number;
  let bgLayer: TileLayer;
  let sourceTiff: GeoTIFF;
  let map: Map;
  let showAllSpots = true;
  let currSample = '';

  let colorOpacity = 0.8;

  let curr = 0;
  let draw: Draw;
  let drawClear: () => void;

  function update(sample: Sample) {
    if (!map) return;
    coords = sample.image.coords!;
    proteinMap = sample.image.channel!;

    if (Object.keys(proteinMap) !== proteins) {
      proteins = Object.keys(proteinMap);
    }

    if (mode !== (sample.image.metadata?.mode ?? 'composite')) {
      mode = sample.image.metadata?.mode ?? 'composite';
      getColorParams = colorVarFactory(mode, proteinMap);

      if (mode === 'composite') {
        imgCtrl = {
          type: 'composite',
          showing: proteins.slice(0, 3),
          maxIntensity: [128, 128, 128]
        };
      } else {
        imgCtrl = { type: 'rgb', Exposure: 0, Contrast: 0, Saturation: 0 };
      }
      bgLayer.setStyle(genBgStyle(mode));
    }

    const urls = sample.image.urls.map((url) => ({ url }));
    sourceTiff = new GeoTIFF({
      normalize: sample.image.metadata!.mode === 'rgb',
      sources: urls
    });
    mPerPx = sample.image.metadata!.spot.mPerPx;

    // Refresh spots
    const previousLayer = spotsLayer;
    spotsSource.clear();
    spotsLayer = new WebGLPointsLayer({
      // @ts-expect-error
      source: spotsSource,
      style: genStyle(sample.image.metadata!.spot.spotDiam / mPerPx)
    });
    map.addLayer(spotsLayer);
    if (previousLayer) {
      map.removeLayer(previousLayer);
      previousLayer.dispose();
    }
    addData(coords, mPerPx);
    updateSpots($currRna);

    // Refresh background
    bgLayer.getSource()?.dispose();
    bgLayer.setSource(sourceTiff);
    map.setView(sourceTiff.getView());

    mPerPx = sample.image.metadata!.spot.mPerPx;
    currSample = sample.name;

    bgLayer?.updateStyleVariables(getColorParams(imgCtrl));

    // adddapi(await fetchArrow<{ x: number; y: number }[]>(sample, 'coordsdapi'));
  }

  const selectStyle = new Style({ stroke: new Stroke({ color: '#ffffff', width: 1 }) });

  let spotsSource: VectorSource<Geometry>;
  // @ts-ignore
  let spotsLayer: WebGLPointsLayer<typeof spotsSource>;
  let circleFeature: Feature<Circle>;
  let activeLayer: VectorLayer<VectorSource<Geometry>>;
  let addData: (coords: { x: number; y: number }[], mPerPx: number) => void;
  let imgCtrl: ImageCtrl;

  onMount(async () => {
    const sample = await promise[0]!;
    const spotDiam = sample.image.metadata!.spot.spotDiam;
    // TODO: Fix this depenedency
    ({ circleFeature, activeLayer } = getCanvasCircle(selectStyle, spotDiam));
    ({ spotsSource, addData } = getWebGLCircles());

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

    bgLayer = new WebGLTileLayer({});
    map = new Map({
      target: 'map',
      layers: [bgLayer, activeLayer]
    });

    map.removeControl(map.getControls().getArray()[0]);
    map.addControl(new Zoom({ delta: 0.4 }));
    map.addControl(new ScaleLine({ text: true, minWidth: 140 }));

    // Hover over a circle.
    map.on('pointermove', (e) => {
      // Cannot use layer.getFeatures for WebGL.
      map.forEachFeatureAtPixel(
        e.pixel,
        (f) => {
          const idx = f.getId() as number | undefined;
          if (idx === curr || !idx) return true;
          $store.currIdx = { idx, source: 'map' }; // As if came from outside.
          curr = idx;
          return true; // Terminates search.
        },
        { layerFilter: (layer) => layer === spotsLayer, hitTolerance: 10 }
      );
    });

    // Lock / unlock a circle.
    map.on('click', (e) => {
      map.forEachFeatureAtPixel(e.pixel, (f) => {
        const idx = f.getId() as number | undefined;
        if (!idx) return true;
        const unlock = idx === $store.lockedIdx.idx;
        $store.lockedIdx = { idx: unlock ? -1 : idx, source: 'scatter' }; // As if came from outside.
        curr = idx;
        return true;
      });
    });

    map.on('movestart', () => (map.getViewport().style.cursor = 'grabbing'));
    map.on('moveend', () => (map.getViewport().style.cursor = 'grab'));
    ({ draw, drawClear } = select(map, spotsSource.getFeatures()));
    draw.on('drawend', () => (selecting = false));

    update(sample);
  });

  // Update "brightness"
  $: if (getColorParams && imgCtrl?.type === mode)
    bgLayer?.updateStyleVariables(getColorParams(imgCtrl));
  $: spotsLayer?.updateStyleVariables({ opacity: colorOpacity });

  function updateSpots(rna: { name: string; values: number[] }) {
    for (let i = 0; i < coords.length; i++) {
      spotsLayer
        .getSource()!
        .getFeatureById(i)
        ?.setProperties({ value: rna.values[i] ?? 0 });
    }
  }
  // Change spot color
  $: if (spotsLayer && coords) {
    updateSpots($currRna);
  }

  // Move view
  $: {
    if (map && coords) {
      const idx = $store.locked ? $store.lockedIdx : $store.currIdx;
      const { x, y } = coords[idx.idx];
      if ($store.currIdx.source !== 'map') {
        const view = map.getView();
        const currZoom = view.getZoom();
        if ($store.locked) {
          view.animate({ center: [x * mPerPx, -y * mPerPx], duration: 100, zoom: 5 });
        } else if (currZoom && currZoom > 2) {
          view.animate({ duration: 100 });
        }
      }
      circleFeature?.getGeometry()?.setCenter([x * mPerPx, -y * mPerPx]);
    }
  }

  // Checkbox show all spots
  $: spotsLayer?.setVisible(showAllSpots);

  // Enable/disable polygon draw
  $: if (map) {
    if (selecting) {
      drawClear();
      map?.addInteraction(draw);
      map.getViewport().style.cursor = 'crosshair';
    } else {
      map?.removeInteraction(draw);
      map.getViewport().style.cursor = 'grab';
    }
  }

  function upload(files: FileList | null) {
    if (files) {
      console.log(URL.createObjectURL(files[0]));
    }
  }

  $: if ($activeSample !== currSample) update($samples[$activeSample]);
</script>

<svelte:body on:resize={() => map?.updateSize()} />

<section class="relative h-full w-full">
  <!-- <label>
    <input type="file" multiple on:change={(e) => upload(e.currentTarget.files)} />
  </label> -->

  <!-- Map -->
  <div
    id="map"
    class="h-full w-full shadow-lg"
    class:rgbmode={mode === 'rgb'}
    class:compositemode={mode === 'composite'}
    bind:this={elem}
  >
    <div
      class="absolute left-4 top-16 z-10 text-lg font-medium opacity-90 lg:top-[5.5rem] xl:text-xl"
    >
      <!-- Spot indicator -->
      <div>Spots: <i>{@html $currRna.name}</i></div>

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
        class="inline-flex flex-col gap-y-1 rounded-lg bg-gray-100/80 p-2 px-3 text-sm font-medium backdrop-blur-sm transition-all hover:bg-gray-200/80 dark:bg-neutral-600/70 dark:text-white/90 dark:hover:bg-neutral-600/90"
      >
        <label class="cursor-pointer">
          <input type="checkbox" class="mr-0.5 opacity-80" bind:checked={showAllSpots} />
          <span>Show all spots</span>
        </label>

        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          bind:value={colorOpacity}
          on:mousedown={() => (showAllSpots = true)}
          class="max-w-[36rem] cursor-pointer opacity-80"
        />
      </div>

      <!-- Select button -->
      <div class="space-x-1">
        <button
          class="rounded bg-sky-600/80 px-2 py-1 text-sm text-white shadow backdrop-blur transition-all hover:bg-sky-600/80 active:bg-sky-500/80 dark:bg-sky-700/70 dark:text-slate-200"
          class:bg-gray-600={selecting}
          class:hover:bg-gray-600={selecting}
          class:active:bg-gray-600={selecting}
          on:click={() => (selecting = true)}
          disabled={selecting}
          >Select
        </button>

        <button
          class="rounded bg-orange-600/80 px-2 py-1 text-sm text-white shadow backdrop-blur transition-all hover:bg-orange-600/80 active:bg-orange-500/80 dark:bg-orange-700/70 dark:text-slate-200"
          on:click={drawClear}
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
    class="absolute bottom-3 flex max-w-[48rem] flex-col rounded-lg bg-gray-200/80 p-2 font-medium backdrop-blur transition-colors dark:bg-gray-800/70 lg:bottom-6 lg:left-4 xl:pr-4"
  >
    {#if mode === 'composite'}
      <svelte:component this={ImgControl} {mode} names={proteins} bind:imgCtrl />
    {:else if mode === 'rgb'}
      <svelte:component this={ImgControl} {mode} bind:imgCtrl />
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
