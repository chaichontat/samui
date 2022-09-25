<script lang="ts">
  import * as Plot from '@observablehq/plot';

  import { sEvent, sFeatureData } from '$lib/store';
  let div: HTMLDivElement;
  let subdiv: Element | undefined;

  function updatePlot(data) {
    console.log('hi');

    if (subdiv) {
      div.removeChild(subdiv);
    }

    subdiv = Plot.plot({
      x: {
        label: data.name.feature
      },
      y: {
        grid: true
      },
      marks: [
        Plot.rectY(
          data.data.map((x) => ({ value: x })),
          Plot.binX({ y: 'count' }, { x: 'value', thresholds: 'sturges' })
        ),
        Plot.ruleY([0])
      ],
      marginTop: 30,
      style: {
        background: 'transparent',
        fontSize: '16px'
      }
    });

    div.appendChild(subdiv);
  }

  $: console.log($sEvent);
  $: if ($sEvent && $sFeatureData) updatePlot($sFeatureData);
</script>

<div bind:this={div} class="p-2" />
