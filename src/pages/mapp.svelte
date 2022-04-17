<script lang="ts">
  import promise from '$lib/meh';
  import type { Sample } from '$src/lib/data/sample';
  import { colorVarFactory, genTileLayer } from '$src/lib/mapp/background';
  import { genStyle, getCanvasCircle, getWebGLCircles } from '$src/lib/mapp/spots';
  import ScaleLine from 'ol/control/ScaleLine';
  import Zoom from 'ol/control/Zoom';
  import type Feature from 'ol/Feature';
  import type { Circle, Geometry, Point } from 'ol/geom.js';
  import type { Draw } from 'ol/interaction.js';
  import type VectorLayer from 'ol/layer/Vector';
  import WebGLPointsLayer from 'ol/layer/WebGLPoints.js';
  import type TileLayer from 'ol/layer/WebGLTile.js';
  import Map from 'ol/Map.js';
  import 'ol/ol.css';
  import GeoTIFF from 'ol/source/GeoTIFF.js';
  import type VectorSource from 'ol/source/Vector.js';
  import { Stroke, Style } from 'ol/style.js';
  import type { LiteralStyle } from 'ol/style/literal.js';
  import { onMount } from 'svelte';
  import ButtonGroup from '../lib/components/buttonGroup.svelte';
  import Colorbar from '../lib/components/colorbar.svelte';
  import { select } from '../lib/mapp/selector';
  import { activeSample, currRna, samples, store } from '../lib/store';

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

  let maxIntensity: [number, number, number] = [100, 100, 100]; // Inverted
  let showing = proteins.slice(0, 3) as [string, string, string];

  let curr = 0;
  let draw: Draw;
  let drawClear: () => void;

  function update(sample: Sample) {
    if (!map) return;
    console.log($samples);
    console.log(sample);

    coords = sample.image.coords!;
    proteinMap = sample.image.channel!;

    const urls = sample.image.urls.map((url) => ({ url }));
    sourceTiff = new GeoTIFF({
      normalize: false,
      sources: urls
    });

    // Refresh spots
    const previousLayer = spotsLayer;
    spotsSource.clear();
    spotsLayer = new WebGLPointsLayer({
      // @ts-expect-error
      source: spotsSource,
      style: genStyle(sample.image.metadata!.spot.spotDiam / sample.image.metadata!.spot.mPerPx)
    });
    map.addLayer(spotsLayer);
    if (previousLayer) {
      map.removeLayer(previousLayer);
      previousLayer.dispose();
    }
    addData(coords);
    updateSpots($currRna);

    // Refresh background
    bgLayer.getSource()?.dispose();
    bgLayer.setSource(sourceTiff);
    map.setView(sourceTiff.getView());

    if (Object.keys(proteinMap) !== proteins) {
      proteins = Object.keys(proteinMap);
      getColorParams = colorVarFactory(proteinMap);
      showing = proteins.slice(0, 3) as [string, string, string];
    }

    mPerPx = sample.image.metadata!.spot.mPerPx;
    currSample = sample.name;

    // adddapi(await fetchArrow<{ x: number; y: number }[]>(sample, 'coordsdapi'));
  }

  const selectStyle = new Style({ stroke: new Stroke({ color: '#ffffff', width: 1 }) });

  let spotsSource: VectorSource<Geometry>;
  let spotsLayer: WebGLPointsLayer<typeof spotsSource>;
  let circleFeature: Feature<Circle>;
  let activeLayer: VectorLayer<VectorSource<Geometry>>;
  let addData: (coords: { x: number; y: number }[]) => void;

  onMount(async () => {
    const sample = await promise[0]!;
    const mPerPx = sample.image.metadata!.spot.mPerPx;
    const spotDiam = sample.image.metadata!.spot.spotDiam;
    // TODO: Fix this depenedency
    ({ circleFeature, activeLayer } = getCanvasCircle(selectStyle, spotDiam));
    ({ spotsSource, addData } = getWebGLCircles(mPerPx));

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

    bgLayer = genTileLayer();
    map = new Map({
      target: 'map',
      layers: [bgLayer, activeLayer]
    });

    map.removeControl(map.getControls().getArray()[0]);
    map.addControl(new Zoom({ delta: 0.4 }));
    map.addControl(
      new ScaleLine({
        text: true,
        minWidth: 140
      })
    );

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
  $: if (getColorParams) bgLayer?.updateStyleVariables(getColorParams(showing, maxIntensity));
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
  $: console.log($activeSample);

  $: if ($activeSample !== currSample) update($samples[$activeSample]);
</script>

<!-- Buttons -->
<div class="flex flex-grow flex-col gap-y-3">
  <!-- <label>
    <input type="file" multiple on:change={(e) => upload(e.currentTarget.files)} />
  </label> -->

  <div class="flex flex-col">
    {#each ['blue', 'green', 'red'] as color, i}
      <div class="flex gap-x-4">
        <ButtonGroup names={proteins} bind:curr={showing[i]} {color} />
        <input
          type="range"
          min="0"
          max="254"
          bind:value={maxIntensity[i]}
          class="hidden cursor-pointer 2xl:block"
        />
      </div>
    {/each}
  </div>
  <!-- Brightness -->
  <div class="flex w-full gap-x-8">
    {#each [0, 1, 2] as i}
      <input
        type="range"
        min="0"
        max="254"
        bind:value={maxIntensity[i]}
        class="block w-full cursor-pointer 2xl:hidden"
      />
    {/each}
  </div>

  <!-- Map -->
  <div id="map" class="relative h-[70vh] shadow-lg" bind:this={elem}>
    <!-- Spot indicator -->
    <div
      class="absolute left-14 top-[1.2rem] z-10 text-lg font-medium text-white opacity-90 xl:text-xl"
    >
      Spots: <i>{@html $currRna.name}</i>
    </div>

    <!-- Color indicator -->
    <div
      class="absolute top-[4.75rem] left-3 z-10 flex flex-col text-lg font-medium text-white opacity-90 xl:text-xl"
    >
      {#each ['text-blue-600', 'text-green-600', 'text-red-600'] as color, i}
        {#if showing[i] !== 'None'}
          <span class={`font-semibold ${color}`}>{showing[i]}</span>
        {/if}
      {/each}
    </div>

    <!-- Show all spots -->
    <div
      class="absolute right-4 top-4 z-50 inline-flex flex-col gap-y-1 rounded-lg bg-neutral-600/70 p-2 px-3 text-sm text-white/90 backdrop-blur-sm transition-all hover:bg-neutral-600/90"
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

    <Colorbar
      class="right-10 top-24 z-10"
      bind:opacity={colorOpacity}
      color="yellow"
      min={0}
      max={10}
    />

    <!-- Select button -->
    <div class="absolute top-[1.05rem] right-[12rem] z-20 space-x-1">
      <button
        class="rounded bg-sky-700/70 px-2 py-1 text-sm text-slate-200 shadow backdrop-blur transition-all hover:bg-sky-600/80 active:bg-sky-500/80"
        class:bg-gray-600={selecting}
        class:hover:bg-gray-600={selecting}
        class:active:bg-gray-600={selecting}
        on:click={() => (selecting = true)}
        disabled={selecting}
        >Select
      </button>

      <button
        class="rounded bg-orange-700/70 px-2 py-1 text-sm text-slate-200 shadow backdrop-blur transition-all hover:bg-orange-600/80 active:bg-orange-500/80"
        on:click={drawClear}
        disabled={selecting}
        >Clear
      </button>
    </div>
  </div>
</div>

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
    @apply left-6 bottom-6 float-right w-3 bg-transparent text-right font-sans;
  }

  #map :global(.ol-scale-line-inner) {
    @apply pb-1 text-sm;
  }
</style>
