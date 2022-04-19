<script lang="ts">
  import { browser } from '$app/env';
  import type { ChunkedJSON, Sparse } from '$src/lib/data/dataHandlers';
  import Chart from 'chart.js/auto/auto.js';
  import { onMount } from 'svelte';
  import { activeSample, multipleSelect, samples, store } from '../lib/store';

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

  async function getRow(i: number): Promise<[string, number][]> {
    const spotGenes = $samples[$activeSample].features.spotGenes as ChunkedJSON;
    const geneNames = ($samples[$activeSample].features.genes as ChunkedJSON).revNames!;
    const row = (await spotGenes.retrieve!(i)) as Sparse;

    const out = [] as [string, number][];
    for (let i = 0; i < row.value.length; i++) {
      if (geneNames[row.index[i]].startsWith('MT-')) continue;
      out.push([geneNames[row.index[i]], row.value[i]]);
    }
    return out;
  }

  let curr = 0;

  // $: if (bar && $done) {
  //   getRow(5)
  //     .then((row) => row.sort(([, val]) => val).slice(0, 10))
  //     .then((row) => (bar.data.datasets[0].data = Object.fromEntries(row)))
  //     .then(() => bar.update())
  //     .then(() => (curr = $store.currIdx.idx))
  //     .catch(console.error);
  // }

  $: if (bar && $store.currIdx.idx !== curr) {
    getRow($store.currIdx.idx)
      .then((row) => {
        const filtered = row.sort((a, b) => b[1] - a[1]).slice(0, 10);
        bar.data.datasets[0].data = filtered.map(([name, val]) => ({ x: name, y: val }));
        bar.update();
        curr = $store.currIdx.idx;
      })
      .catch(console.error);
    // if ($store.lockedIdx.idx !== -1) {
    //   // Locked
    //   getRow($store.lockedIdx.idx)
    //     .then((row) => row.sort(([, val]) => val).slice(0, 10))
    //     .then((row) => (bar.data.datasets[0].data = Object.fromEntries(row)))
    //     .then(() => bar.update())
    //     .catch(console.error);
    // } else {
    // getRow($store.currIdx.idx)
    //   .then((row) => row.sort(([, val]) => val).slice(0, 10))
    //   .then((row) => (bar.data.datasets[0].data = Object.fromEntries(row)))
    //   .then(() => bar.update())
    //   .then(() => (curr = $store.currIdx.idx))
    //   .catch(console.error);
    // }
    // bar.options.scales!.y!.max = 10;
    // bar.update();
  }

  // $: {
  //   if (data && bar && $multipleSelect.length === 0) {
  //     if ($store.lockedIdx.idx !== -1) {
  //       // Locked
  //       bar.data.datasets[0].data = getRow(data, $store.lockedIdx.idx);
  //     } else {
  //       bar.data.datasets[0].data = getRow(data, $store.currIdx.idx);
  //     }
  //     bar.options.scales!.y!.max = 10;
  //     bar.update();
  //   }
  // }

  // $: if (data && bar && $multipleSelect.length > 0) {
  //   const summed = Object.keys(data).reduce((acc, key) => {
  //     acc[key] = $multipleSelect.map((v) => data[key][v]).reduce((a, b) => a + b, 0);
  //     return acc;
  //   }, {} as ReturnType<typeof getRow>);
  //   bar.data.datasets[0].data = summed;
  //   bar.options.scales!.y!.max = undefined;
  //   bar.update();
  // }
</script>

<!-- {@debug d} -->

<div class="relative w-full"><canvas id="bar" /></div>
