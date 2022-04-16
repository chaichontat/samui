<script lang="ts">
  import { browser } from '$app/env';
  import Chart from 'chart.js/auto/auto.js';
  import { onMount } from 'svelte';
  import { multipleSelect, store } from '../lib/store';
  import { dataPromise } from '../routes/index.svelte';

  let data: Awaited<typeof dataPromise>['data'];

  (async () => {
    if (browser) ({ data } = await dataPromise);
  })().catch(console.error);

  Chart.defaults.font.size = 14;

  let bar: Chart<'bar', Record<string, number>, string>;
  onMount(() => {
    if (!browser) return;
    const ctx = (document.getElementById('bar') as HTMLCanvasElement).getContext('2d')!;
    bar = new Chart(ctx, {
      type: 'bar',
      data: {
        datasets: [
          {
            data: {},
            backgroundColor: 'white',
            normalized: true
          }
        ]
      },
      options: {
        scales: {
          x: {
            grid: { borderColor: 'white' },
            ticks: { color: 'white' },
            position: 'top'
          },
          y: {
            min: 0,
            grid: { borderColor: 'white' },
            ticks: { color: 'white' },
            reverse: true
          }
        },
        // transitions: { active: { animation: false } },
        animation: { duration: 200 },
        plugins: {
          tooltip: { enabled: false },
          legend: { display: false }
        }
      }
    });
  });

  function getRow<T extends string>(data: Record<T, number[]>, i: number) {
    return Object.keys(data).reduce((acc, key) => {
      acc[key as T] = data[key as T][i];
      return acc;
    }, {} as Record<T, number>);
  }

  $: {
    if (data && bar && $multipleSelect.length === 0) {
      if ($store.lockedIdx.idx !== -1) {
        // Locked
        bar.data.datasets[0].data = getRow(data, $store.lockedIdx.idx);
      } else {
        bar.data.datasets[0].data = getRow(data, $store.currIdx.idx);
      }
      bar.options.scales!.y!.max = 10;
      bar.update();
    }
  }

  $: if (data && bar && $multipleSelect.length > 0) {
    const summed = Object.keys(data).reduce((acc, key) => {
      acc[key] = $multipleSelect.map((v) => data[key][v]).reduce((a, b) => a + b, 0);
      return acc;
    }, {} as ReturnType<typeof getRow>);
    bar.data.datasets[0].data = summed;
    bar.options.scales!.y!.max = undefined;
    bar.update();
  }
</script>

<div class="relative w-full"><canvas id="bar" /></div>
