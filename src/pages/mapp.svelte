<script lang="ts">
  import { browser, dev } from '$app/env';
  import { base } from '$app/paths';
  import { colorVarFactory, getCanvasCircle, getWebGLCircles } from '$src/lib/mapp/maplib';
  import { ScaleLine, Zoom } from 'ol/control.js';
  import type { Geometry, Point } from 'ol/geom.js';
  import type { Draw } from 'ol/interaction.js';
  import WebGLPointsLayer from 'ol/layer/WebGLPoints.js';
  import TileLayer from 'ol/layer/WebGLTile.js';
  import Map from 'ol/Map.js';
  import 'ol/ol.css';
  import GeoTIFF from 'ol/source/GeoTIFF.js';
  import type VectorSource from 'ol/source/Vector.js';
  import { Stroke, Style } from 'ol/style.js';
  import type { LiteralStyle } from 'ol/style/literal.js';
  import { onMount } from 'svelte';
  import ButtonGroup from '../lib/components/buttonGroup.svelte';
  import Colorbar from '../lib/components/colorbar.svelte';
  import type getData from '../lib/fetcher';
  import { fetchArrow } from '../lib/fetcher';
  import { select } from '../lib/mapp/selector';
  import { currRna, params, store } from '../lib/store';
  import { dataPromise, proteinMap, sample } from '../routes/index.svelte';

  let elem: HTMLDivElement;
  let selecting = false;
  const proteins = Object.keys(proteinMap) as keyof typeof proteinMap;
  const getColorParams = colorVarFactory(proteinMap);

  let coords: Awaited<typeof dataPromise>['coords'];

  let bgLayer: TileLayer;
  let sourceTiff: GeoTIFF;
  let map: Map;
  let showAllSpots = true;

  let colorOpacity = 0.8;

  let maxIntensity: [number, number, number] = [100, 100, 100]; // Inverted
  let showing = proteins.slice(0, 3) as [string, string, string];

  let curr = 0;
  let draw: Draw;
  let drawClear: () => void;

  if (browser) {
    sourceTiff = new GeoTIFF({
      normalize: false,
      sources: dev
        ? [
            // TODO: Why does GeoTiff.js fill the last band from the penultimate band?
            { url: `${base}/cogs/${sample}_1.tif` },
            { url: `${base}/cogs/${sample}_2.tif` }
          ]
        : [
            {
              url: `https://chaichontat-host.s3.us-west-004.backblazeb2.com/libd-rotation/${sample}_1.tif`
            },
            {
              url: `https://chaichontat-host.s3.us-west-004.backblazeb2.com/libd-rotation/${sample}_2.tif`
            }
          ]
    });
  }

  const spot_px = params.spotDiam / params.mPerPx;

  const genStyle = (): LiteralStyle => ({
    variables: { opacity: 0.5 },
    symbol: {
      symbolType: 'circle',
      size: [
        'interpolate',
        ['exponential', 2],
        ['zoom'],
        1,
        spot_px / 32,
        2,
        spot_px / 16,
        3,
        spot_px / 8,
        4,
        spot_px / 4,
        5,
        spot_px
      ],
      color: '#fce652ff',

      // color: ['interpolate', ['linear'], ['get', rna], 0, '#00000000', 8, '#fce652ff'],
      opacity: ['clamp', ['*', ['var', 'opacity'], ['/', ['get', 'value'], 8]], 0.1, 1]
      // opacity: ['clamp', ['var', 'opacity'], 0.05, 1]
    }
  });

  const selectStyle = new Style({ stroke: new Stroke({ color: '#ffffff', width: 1 }) });
  const { circleFeature, activeLayer } = getCanvasCircle(selectStyle);
  let { spotsSource, addData } = getWebGLCircles();
  let { spotsSource: dapi, addData: adddapi } = getWebGLCircles();
  let spotsLayer: WebGLPointsLayer<VectorSource<Point>>;

  async function hydrate(
    dataPromise: ReturnType<typeof getData>,
    spotsSource: VectorSource<Geometry>
  ) {
    ({ coords } = await dataPromise);
    addData(coords);
    ({ draw, drawClear } = select(map, spotsSource.getFeatures()));
    draw.on('drawend', () => (selecting = false));

    adddapi(await fetchArrow<{ x: number; y: number }[]>(sample, 'coordsdapi'));
  }

  onMount(() => {
    spotsLayer = new WebGLPointsLayer({
      // @ts-expect-error
      source: spotsSource,
      style: genStyle()
    });

    const dapiLayer = new WebGLPointsLayer({
      // @ts-expect-error
      source: dapi,
      style: {
        symbol: {
          symbolType: 'square',
          size: 4,
          color: '#ffffff',
          opacity: 0.5
        }
      },
      minZoom: 4
    });

    bgLayer = new TileLayer({
      style: {
        variables: getColorParams(showing, maxIntensity),
        color: [
          'array',
          ['*', ['/', ['band', ['var', 'red']], ['var', 'redMax']], ['var', 'redMask']],
          ['*', ['/', ['band', ['var', 'green']], ['var', 'greenMax']], ['var', 'greenMask']],
          ['*', ['/', ['band', ['var', 'blue']], ['var', 'blueMax']], ['var', 'blueMask']],
          1
        ]
      },
      source: sourceTiff
    });

    map = new Map({
      target: 'map',
      layers: [bgLayer, spotsLayer, dapiLayer, activeLayer],
      view: sourceTiff.getView()
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

    hydrate(dataPromise, spotsSource).catch(console.error);
  });

  // Update "brightness"
  $: bgLayer?.updateStyleVariables(getColorParams(showing, maxIntensity));
  $: spotsLayer?.updateStyleVariables({ opacity: colorOpacity });

  // Change spot color
  $: if (spotsLayer && coords) {
    for (let i = 0; i < coords.length; i++) {
      spotsLayer
        .getSource()!
        .getFeatureById(i)
        ?.setProperties({ value: $currRna.values[i] ?? 0 });
    }
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
          view.animate({ center: [x * params.mPerPx, -y * params.mPerPx], duration: 100, zoom: 5 });
        } else if (currZoom && currZoom > 2) {
          view.animate({ duration: 100 });
        }
      }
      circleFeature?.getGeometry()?.setCenter([x * params.mPerPx, -y * params.mPerPx]);
    }
  }

  // Checkbox show all spots
  $: spotsLayer?.setVisible(showAllSpots);

  // Enable/disable polygon draw
  $: if (elem) {
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
