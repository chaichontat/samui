<script lang="ts">
  import ButtonGroup from '$src/lib/components/buttonGroup.svelte';
  import Colorbar from '$src/lib/components/colorbar.svelte';
  import Chart, { type ChartConfiguration, type ChartEvent } from 'chart.js/auto/auto.js';
  import ChartDataLabels from 'chartjs-plugin-datalabels';
  import colormap from 'colormap';
  import { onMount } from 'svelte';
  import type getData from '../lib/fetcher';
  import { currRna, store } from '../lib/store';
  import { genLRU } from '../lib/utils';
  import { dataPromise } from '../routes/index.svelte';
  let curr = 0;

  let coords: Awaited<typeof dataPromise>['coords'];
  let myChart: Chart<'scatter', { x: number; y: number }[], string>;
  let getColor: (name: string) => string[];

  const colors = colormap({ colormap: 'viridis', nshades: 256, format: 'hex' });

  async function hydrate(dataPromise: ReturnType<typeof getData>) {
    ({ coords } = await dataPromise);
    getColor = genLRU((name: string): string[] => {
      const out = [];
      for (const d of $currRna.values) {
        const idx = Math.round(Math.min(d / 10, 1) * 255);
        out.push(colors[idx]);
      }
      return out;
    });

    const min = coords
      .reduce((acc, { x, y }) => [Math.min(acc[0], x), Math.min(acc[1], y)], [Infinity, Infinity])
      .map((x) => x - 100);
    const max = coords
      .reduce((acc, { x, y }) => [Math.max(acc[0], x), Math.max(acc[1], y)], [0, 0])
      .map((x) => x + 100);

    for (const c of [myChart, anotherChart]) {
      c.options.scales!.x!.min = min[0] - 100;
      c.options.scales!.x!.max = max[0] + 100;
      c.options.scales!.y!.min = min[1] - 100;
      c.options.scales!.y!.max = max[1] + 100;
      c.update();
    }

    myChart.data.datasets[0].data = coords;
    // $currRna = Object.keys(data)[0];
  }

  function changeColor(chart: Chart, name: string): void {
    if (!chart || !getColor) return;
    chart.data.datasets[0].backgroundColor = getColor(name);
    chart.update();
  }

  const chartOptions: ChartConfiguration<'scatter'> = {
    animation: false,
    aspectRatio: 1,
    scales: {
      x: {
        display: false
      },
      y: {
        display: false,
        reverse: true
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false }
    }
  };

  //   console.log(min);
  let anotherChart: Chart<'scatter', { x: number; y: number }[], string>;
  onMount(() => {
    anotherChart = new Chart(
      (document.getElementById('another') as HTMLCanvasElement).getContext('2d')!,
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
      (document.getElementById('myChart') as HTMLCanvasElement).getContext('2d')!,
      {
        data: {
          datasets: [
            {
              type: 'scatter',
              data: coords,
              normalized: true,
              pointRadius: 2.5,
              pointHoverRadius: 20,
              pointHoverBorderWidth: 1,
              pointHoverBorderColor: '#eeeeee',
              pointHitRadius: 3
            }
          ]
        },
        options: chartOptions
      }
    );

    hydrate(dataPromise).catch(console.error);
  });

  // Change color for different markers.
  $: changeColor(myChart, $currRna.name);

  // Decision on what to show.
  $: if (coords && anotherChart) {
    const idx = $store.locked ? $store.lockedIdx.idx : $store.currIdx.idx;
    anotherChart.data.datasets[0].data = [coords[idx]];
    anotherChart.data.datasets[0].backgroundColor = getColor($currRna.name)[idx] + 'cc';
    anotherChart.update();
  }
</script>

<!-- {#if data}
  <ButtonGroup names={Object.keys(data)} color="slate" bind:curr={$currRna} />
{/if} -->

<div class="relative z-10">
  <Colorbar min={0} max={10} />
  <canvas class="absolute" id="another" />
  <canvas class="" id="myChart" />
  <!-- <div
    class="absolute left-10 top-10 z-10 rounded-lg bg-white/10 px-3 py-1 text-lg font-medium text-white opacity-90 backdrop-blur-sm"
  >
    {$currRna}
  </div> -->
</div>
