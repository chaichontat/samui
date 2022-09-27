<script lang="ts">
  import { sFeatureData, sId } from '$lib/store';
  import { oneLRU } from '$src/lib/lru';
  import * as Plot from '@observablehq/plot';
  import Chart from 'chart.js/auto';
  import * as d3 from 'd3';
  import { onMount } from 'svelte';
  let div: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let subdiv: Element | undefined;

  let chart: Chart;

  onMount(() => {
    chart = new Chart(canvas, {
      type: 'bar',
      data: { labels: [], datasets: [] },
      options: {
        responsive: false,
        animation: false,
        // parsing: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { drawBorder: false, color: '#ffffff55', lineWidth: 0.5 } }
        }
      }
    });
  });

  const updatePlot = oneLRU((name: any) => {
    // if (subdiv) {
    //   div.removeChild(subdiv);
    // }

    const data = $sFeatureData.data;
    // if (typeof data[0] !== 'string') return;

    const binned = d3.bin()(data as number[]);
    const label = [];
    const b = [];

    for (let i = 0; i < binned.length; i++) {
      label.push(binned[i].x0);
      b.push(binned[i].length);
    }

    chart.data = {
      labels: label,
      datasets: [{ data: b, borderWidth: 0, backgroundColor: '#fde68a' }]
    };
    chart.update();
    console.log(b);

    // subdiv = Plot.plot({
    //   x: { label: $sFeatureData.name.feature },
    //   y: {
    //     // percent: true,
    //     grid: true
    //   },
    //   color: {
    //     interpolate: d3.interpolateTurbo,
    //     domain: [0, 10]
    //   },
    //   marks: [
    //     Plot.rectY(
    //       $sFeatureData.data.map((x) => ({ value: x })),
    //       Plot.binX(
    //         { y: 'count', fill: 'median' },
    //         { x: 'value', thresholds: 'sturges', fill: 'value' }
    //       )
    //     ),
    //     Plot.ruleY([0]),
    //     Plot.link(
    //       [
    //         { x1: n, y1: 300, x2: n, y2: 50 }
    //         //   { x: 5, y: 300 }
    //       ],
    //       {
    //         x1: 'x1',
    //         y1: 'y1',
    //         x2: 'x2',
    //         y2: 'y2',
    //         stroke: '#f97316',
    //         strokeWidth: 3,
    //         markerEnd: 'arrow'
    //       }
    //     )
    //   ],
    //   marginLeft: 40,
    //   marginTop: 35,
    //   style: {
    //     background: 'transparent',
    //     fontSize: '18px'
    //   }
    // });

    // div.appendChild(subdiv);
  });

  $: if (div && $sId.idx != undefined && $sFeatureData && $sFeatureData.dataType !== 'singular') {
    updatePlot($sFeatureData.name);
  }
</script>

<div bind:this={div} class="overflow-visible p-2" />
<canvas bind:this={canvas} class="mr-2 -ml-2 -mt-2" />
