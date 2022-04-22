<script lang="ts">
  import type { Sample } from '$lib/data/sample';
  import { tableau10 } from '$src/lib/colors';
  import Colorbar from '$src/lib/components/colorbar.svelte';
  import type { PlainJSON } from '$src/lib/data/dataHandlers';
  import { chartOptions } from '$src/lib/scatter/scatterlib';
  import Chart, { type ChartEvent } from 'chart.js/auto';
  import ChartDataLabels from 'chartjs-plugin-datalabels';
  import colormap from 'colormap';
  import { onMount } from 'svelte';
  import { activeSample, currRna, samples, store } from '../lib/store';
  import { genLRU, genUpdate } from '../lib/utils';

  export let coordsSource = 'coords';
  export let intensitySource = 'genes'; // Accepts PlainJSON only.

  export let opacity = 'ff';
  export let pointRadius = 2.5;

  let currColor: string[];
  let curr = 0;

  let coords: readonly { x: number; y: number }[];

  const colors = colormap({ colormap: 'viridis', nshades: 256, format: 'hex' });

  let myChart: Chart<'scatter', { x: number; y: number }[], string>;

  async function anotherGetColor(sample: string, name: string) {
    const out = [];
    if (intensitySource !== 'genes') console.log('here');
    if (intensitySource === 'genes') {
      for (const d of (await $samples[sample].features.genes.retrieve!(name)) as number[]) {
        const idx = Math.round(Math.min(d / 10, 1) * 255);
        out.push(colors[idx] + opacity);
      }
    } else {
      const v = ($samples[sample].features[intensitySource] as PlainJSON).values as number[];
      const vals = Object.values(tableau10);
      const max = Math.max(...v);
      for (const d of v) {
        // const idx = Math.round(Math.min(d / max, 1) * 255);
        out.push(vals[d] + opacity);
      }
    }
    return out;
  }

  let getColor: (sample: string, name: string) => Promise<void>;
  getColor = async (sample: string, name: string): Promise<void> => {
    if (intensitySource === 'genes') {
      if (!$samples[sample].features[intensitySource]?.retrieve) return;
    } else {
      if (!$samples[sample].features[intensitySource]?.values) return;
    }
    currColor = await anotherGetColor(sample, name);
  };

  const update = genUpdate(samples, (s: Sample) => {
    if (!myChart || !anotherChart) return;

    if (coordsSource === 'coords') {
      coords = s.image.coords!;
    } else {
      if (s.features[coordsSource]) {
        coords = s.features[coordsSource].values;
        getColor(s.name, $currRna.name).catch(console.error);
      } else {
        console.error(`No such feature: ${coordsSource}`);
        coords = [];
        return;
      }
    }

    if (!s.features[intensitySource]) {
      console.error(`No such intensity feature: ${intensitySource}`);
    }

    const min = coords
      .reduce((acc, { x, y }) => [Math.min(acc[0], x), Math.min(acc[1], y)], [Infinity, Infinity])
      .map((x) => x);
    const max = coords
      .reduce((acc, { x, y }) => [Math.max(acc[0], x), Math.max(acc[1], y)], [0, 0])
      .map((x) => x);

    // @ts-ignore
    myChart.data.datasets[0].data = coords;
    const over = 0.05;
    const range = [max[0] - min[0], max[1] - min[1]];

    for (const c of [myChart, anotherChart]) {
      c.options.scales!.x!.min = min[0] - over * range[0];
      c.options.scales!.x!.max = max[0] + over * range[0];
      c.options.scales!.y!.min = min[1] - over * range[1];
      c.options.scales!.y!.max = max[1] + over * range[0];
      c.update();
    }

    currSample = s.name;

    getColor(s.name, $currRna.name).catch(console.error);
  });

  function changeColor(chart: Chart, currColor: string[]): void {
    if (!chart || !currColor) return;
    chart.data.datasets[0].backgroundColor = currColor;
    chart.update();
  }

  let anotherChart: Chart<'scatter', { x: number; y: number }[], string>;
  onMount(() => {
    anotherChart = new Chart(
      (
        document.getElementById(`${coordsSource}-${intensitySource}-another`) as HTMLCanvasElement
      ).getContext('2d')!,
      {
        type: 'scatter',
        data: {
          datasets: [
            {
              data: [],
              normalized: true,
              pointRadius: 25,
              pointHoverRadius: 25,
              borderColor: '#eeeeeedd'
            }
          ]
        },
        plugins: [ChartDataLabels],
        options: {
          ...chartOptions,
          plugins: {
            ...chartOptions.plugins,
            datalabels: {
              formatter: () => $currRna.values[$store.currIdx.idx]?.toFixed(2) ?? '',
              align: 'center',
              anchor: 'end',
              offset: 2,
              color: '#FFFFFF',
              font: { size: 14 }
            }
          },
          onHover: (evt: ChartEvent) => {
            if (!myChart || !evt.native || $store.locked) return;
            const points = myChart.getElementsAtEventForMode(
              evt.native,
              'nearest',
              { intersect: true },
              true
            );

            anotherChart.canvas.style.cursor = points.length > 0 ? 'pointer' : '';
            if (points.length === 0 || points[0].index === curr) return;
            curr = points[0].index;
            if (!$store.locked) {
              $store.currIdx = { idx: points[0].index, source: 'scatter' };
            }
          },

          onClick: (evt: ChartEvent) => {
            if (!myChart) return;
            if (evt.native) {
              const points = myChart.getElementsAtEventForMode(
                evt.native,
                'nearest',
                { intersect: true },
                true
              );
              if (points.length === 0) return;
              curr = points[0].index;
            }
            $store.lockedIdx.idx = $store.lockedIdx.idx === curr ? -1 : curr;
            $store.currIdx = { idx: curr, source: 'scatter' };
          }
        }
      }
    );

    myChart = new Chart(
      (
        document.getElementById(`${coordsSource}-${intensitySource}-myChart`) as HTMLCanvasElement
      ).getContext('2d')!,
      {
        data: {
          datasets: [
            {
              type: 'scatter',
              data: [],
              parsing: false,
              normalized: true,
              pointRadius
            }
          ]
        },
        options: { ...chartOptions }
      }
    );

    update($activeSample).catch(console.error);
  });

  $: getColor($activeSample, $currRna.name).catch(console.error);

  // Change color for different markers.
  $: changeColor(myChart, currColor);

  $: if (intensitySource) {
    getColor($activeSample, $currRna.name).catch(console.error);
  }

  // Decision on what to show.
  $: if (coords && anotherChart && currColor) {
    const idx = $store.locked ? $store.lockedIdx.idx : $store.currIdx.idx;
    anotherChart.data.datasets[0].data = [coords[idx]];
    anotherChart.data.datasets[0].backgroundColor = currColor[idx];
    anotherChart.update();
  }

  let currSample = $activeSample;
  $: if ($activeSample !== currSample) {
    update($activeSample).catch(console.error);
  }
</script>

<div class="relative z-10 mx-auto w-full max-w-[400px]">
  {#if coords?.length === 0}
    <div class="text-center text-lg text-slate-200">No data available.</div>
  {:else}
    <Colorbar min={0} max={10} />
  {/if}

  <canvas class="absolute" id={`${coordsSource}-${intensitySource}-another`} />
  <canvas class="" id={`${coordsSource}-${intensitySource}-myChart`} />
  <!-- <div
    class="absolute left-10 top-10 z-10 rounded-lg bg-white/10 px-3 py-1 text-lg font-medium text-white opacity-90 backdrop-blur-sm"
  >
    {$currRna}
  </div> -->
</div>
