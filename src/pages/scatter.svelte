<script lang="ts">
  import type { Sample } from '$lib/data/sample';
  import Colorbar from '$src/lib/components/colorbar.svelte';
  import { chartOptions } from '$src/lib/scatter/scatterlib';
  import Chart, { type ChartEvent } from 'chart.js/auto';
  import ChartDataLabels from 'chartjs-plugin-datalabels';
  import colormap from 'colormap';
  import { onMount } from 'svelte';
  import { activeSample, currRna, samples, store } from '../lib/store';
  import { genLRU } from '../lib/utils';

  export let target = 'coords';

  let currSample = '';
  let curr = 0;

  let coords: { x: number; y: number }[];

  let myChart: Chart<'scatter', { x: number; y: number }[], string>;
  let getColor: (sample: string | undefined, name: string) => string[];
  getColor = genLRU((sample: string | undefined, name: string): string[] => {
    const out = [];
    for (const d of $currRna.values) {
      const idx = Math.round(Math.min(d / 10, 1) * 255);
      out.push(colors[idx]);
    }
    return out;
  });

  const colors = colormap({ colormap: 'viridis', nshades: 256, format: 'hex' });

  function update(s: Sample) {
    if (!myChart || !anotherChart) return;

    if (target === 'coords') {
      coords = s.image.coords!;
    } else {
      coords = s.features[target] as { x: number; y: number }[];
    }

    const min = coords
      .reduce((acc, { x, y }) => [Math.min(acc[0], x), Math.min(acc[1], y)], [Infinity, Infinity])
      .map((x) => x);
    const max = coords
      .reduce((acc, { x, y }) => [Math.max(acc[0], x), Math.max(acc[1], y)], [0, 0])
      .map((x) => x);

    myChart.data.datasets[0].data = coords;
    const over = 0.05;
    const range = [max[0] - min[0], max[1] - min[1]];
    console.log(coords);

    for (const c of [myChart, anotherChart]) {
      c.options.scales!.x!.min = min[0] - over * range[0];
      c.options.scales!.x!.max = max[0] + over * range[0];
      c.options.scales!.y!.min = min[1] - over * range[1];
      c.options.scales!.y!.max = max[1] + over * range[0];
      c.update();
    }

    currSample = s.name;
  }

  function changeColor(chart: Chart, name: string): void {
    if (!chart || !getColor) return;
    chart.data.datasets[0].backgroundColor = getColor($activeSample, name);
    chart.update();
  }

  let anotherChart: Chart<'scatter', { x: number; y: number }[], string>;
  onMount(() => {
    anotherChart = new Chart(
      (document.getElementById(`${target}-another`) as HTMLCanvasElement).getContext('2d')!,
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
              align: 'end',
              anchor: 'end',
              offset: 2,
              color: '#A8A29E',
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
      (document.getElementById(`${target}-myChart`) as HTMLCanvasElement).getContext('2d')!,
      {
        data: {
          datasets: [
            {
              type: 'scatter',
              data: [],
              parsing: false,
              normalized: true,
              pointRadius: 2.5,
              pointHoverRadius: 20,
              pointHoverBorderWidth: 1,
              pointHoverBorderColor: '#eeeeee',
              pointHitRadius: 3
            }
          ]
        },
        options: { ...chartOptions }
      }
    );

    // update();
  });

  // Change color for different markers.
  $: changeColor(myChart, $currRna.name);

  // Decision on what to show.
  $: if (coords && anotherChart) {
    const idx = $store.locked ? $store.lockedIdx.idx : $store.currIdx.idx;
    anotherChart.data.datasets[0].data = [coords[idx]];
    anotherChart.data.datasets[0].backgroundColor =
      getColor($activeSample, $currRna.name)[idx] + 'cc';
    anotherChart.update();
  }
  $: if ($activeSample !== currSample) update($samples[$activeSample]);
</script>

<div class="relative z-10">
  <Colorbar min={0} max={10} />
  <canvas class="absolute" id={`${target}-another`} />
  <canvas class="" id={`${target}-myChart`} />
  <!-- <div
    class="absolute left-10 top-10 z-10 rounded-lg bg-white/10 px-3 py-1 text-lg font-medium text-white opacity-90 backdrop-blur-sm"
  >
    {$currRna}
  </div> -->
</div>
