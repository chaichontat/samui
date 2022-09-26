<script lang="ts">
  import { sFeatureData, sId } from '$lib/store';
  import * as Plot from '@observablehq/plot';
  import * as d3 from 'd3';
  let div: HTMLDivElement;
  let subdiv: Element | undefined;

  function updatePlot(n: number) {
    console.log('hi');

    if (subdiv) {
      div.removeChild(subdiv);
    }

    subdiv = Plot.plot({
      x: {
        label: $sFeatureData.name.feature
      },
      y: {
        // percent: true,
        grid: true
      },
      color: {
        interpolate: d3.interpolateTurbo,
        domain: [0, 10]
      },
      marks: [
        Plot.rectY(
          $sFeatureData.data.map((x) => ({ value: x })),
          Plot.binX(
            { y: 'count', fill: 'median' },
            { x: 'value', thresholds: 'sturges', fill: 'value' }
          )
        ),
        Plot.ruleY([0]),
        Plot.link(
          [
            { x1: n, y1: 300, x2: n, y2: 50 }
            //   { x: 5, y: 300 }
          ],
          {
            x1: 'x1',
            y1: 'y1',
            x2: 'x2',
            y2: 'y2',
            stroke: '#f97316',
            strokeWidth: 3,
            markerEnd: 'arrow'
          }
        )
      ],
      marginLeft: 40,
      marginTop: 35,
      style: {
        background: 'transparent',
        fontSize: '18px'
      }
    });

    div.appendChild(subdiv);
  }

  // $: if ($sFeatureData) updatePlot($);

  $: if ($sId && $sFeatureData && $sFeatureData.dataType !== 'singular') {
    updatePlot($sFeatureData.data[$sId.idx]);
  }
</script>

<div bind:this={div} class="overflow-visible p-2" />
