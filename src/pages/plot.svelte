<script lang="ts">
  import { sFeatureData, sId } from '$lib/store';
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
      type: 'line',
      data: {
        datasets: []
      },

      options: {
        parsing: false,
        scales: { x: { min: 0, max: 10 } },
        plugins: { legend: { display: false } }
      }
    });
  });

  function updatePlot(n: number) {
    // if (subdiv) {
    //   div.removeChild(subdiv);
    // }

    const data = $sFeatureData.data;
    const binned = d3.bin()(data);
    // const b = [];

    for (let i = 0; i < binned.length; i++) {
      b.push({ x: binned[i].x0, y: binned[i].length });
    }

    chart.data.datasets = [{ data: b }];
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
  }

  $: if (div && $sId && $sFeatureData && $sFeatureData.dataType !== 'singular') {
    updatePlot($sFeatureData.data[$sId.idx]);
  }
</script>

<div bind:this={div} class="overflow-visible p-2" />
<canvas bind:this={canvas} />
