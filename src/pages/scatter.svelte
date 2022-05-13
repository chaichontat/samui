<script lang="ts">
  import { tableau10arr } from '$src/lib/colors';
  import Colorbar from '$src/lib/components/colorbar.svelte';
  import Legend from '$src/lib/components/legend.svelte';
  import { Charts } from '$src/lib/scatter/scatterlib';
  import { keyLRU, keyOneLRU, type Named } from '$src/lib/utils';
  import type { ChartConfiguration } from 'chart.js';
  import genColormap from 'colormap';
  import { onMount } from 'svelte';

  const id = Math.random();

  export let colormap = 'viridis';
  export let colorbar = false;
  export let coordsSource: Named<{ x: number; y: number }[]>;
  export let minmax: 'auto' | [number, number] = 'auto';
  export let filter: number[] = [];
  export let currHover: number | null = null;
  export let mainChartOptions: ChartConfiguration<'scatter'> | undefined = undefined;
  export let hoverChartOptions: ChartConfiguration<'scatter'> | undefined = undefined;

  interface IntensitySource extends Named<number[] | Promise<number[]>> {
    dataType: 'categorical' | 'quantitative';
  }

  export let intensitySource: IntensitySource;
  export let opacity = 'ff';
  export let pointRadius = 2.5;

  let catLegend: Record<number | string, `#${string}`> | undefined;
  const charts = new Charts({
    onHover: (idx) => (currHover = idx),
    mainChartOptions,
    hoverChartOptions
  });

  const _color256 = genColormap({ colormap, nshades: 256, format: 'hex' });
  let colors: string[];

  const update = async ({
    coords,
    intensity
  }: {
    coords: Named<{ x: number; y: number }[]>;
    intensity: IntensitySource;
  }) => {
    if (coords) {
      await updateCoords({ key: coords.name, args: [coords.values] });
    }

    if (intensity) {
      if (intensity.values instanceof Promise) {
        intensity.values = await intensity.values;
      }

      if (intensity.values) {
        ({ colors, legend: catLegend } = calcColor({
          key: intensity.name,
          args: [intensity.values, intensity.dataType ?? 'quantitative']
        }));

        await updateColors({ key: intensity.name, args: [colors] });
      }
    }
  };

  const calcColor = keyLRU((intensity: number[], dataType: 'categorical' | 'quantitative') => {
    let _color = [];
    if (!intensity.every((x) => x !== undefined)) {
      throw new Error('Intensity source is not ready.');
    }

    switch (dataType) {
      case 'categorical':
        // eslint-disable-next-line no-case-declarations
        const unique = [...new Set(intensity)];
        // eslint-disable-next-line no-case-declarations
        const legend = {} as Record<number | string, `#${string}`>;
        for (const [i, x] of unique.entries()) {
          legend[x] = (tableau10arr[i % tableau10arr.length] + opacity) as `#${string}`;
        }
        _color = intensity.map((x) => legend[x]);
        return { colors: _color, legend };

      case 'quantitative':
        // TODO get percentile
        // eslint-disable-next-line no-case-declarations
        const thresh = 10; // minmax === 'auto' ? Math.max(...intensitySource) : minmax[1];
        for (const d of intensity) {
          const idx = Math.round(Math.min((d ?? 0) / thresh, 1) * 255);
          _color.push(_color256[idx] + opacity);
        }
        return { colors: _color };

      default:
        throw new Error('Unknown data type.');
    }
  });

  const updateCoords = keyOneLRU(
    async (c: { x: number; y: number }[]) => await charts.update({ coords: c })
  );
  const updateColors = keyOneLRU(async (color: string[] | string) => {
    await charts.update({ color });
    if (typeof color === 'string') return false;
  });

  onMount(() => {
    charts.mount(
      document.getElementById(`${id}-main`) as HTMLCanvasElement,
      document.getElementById(`${id}-hover`) as HTMLCanvasElement
    );
    update({ coords: coordsSource, intensity: intensitySource }).catch(console.error);
  });

  $: if (currHover) charts.triggerHover(currHover);
  $: update({ coords: coordsSource, intensity: intensitySource }).catch(console.error);
</script>

<div class="relative mx-auto w-full max-w-[400px]">
  {#if colorbar && intensitySource?.dataType === 'quantitative'}
    <Colorbar min={0} max={10} />
  {/if}
  {#if colorbar && intensitySource?.dataType === 'categorical' && catLegend}
    <Legend colormap={catLegend} />
  {/if}
  <canvas class="absolute" id={`${id}-hover`} />
  <canvas class="" id={`${id}-main`} />
  <!-- <div
    class="absolute left-10 top-10 z-10 rounded-lg bg-white/10 px-3 py-1 text-lg font-medium text-white opacity-90 backdrop-blur-sm"
  >
  </div> -->
</div>
