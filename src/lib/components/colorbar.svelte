<script lang="ts">
  import { overlays, sEvent, sFeatureData, sOverlay } from '$lib/store';
  import * as Plot from '@observablehq/plot';
  import * as d3 from 'd3';
  export let color = 'viridis' | 'turbo';

  let div: HTMLDivElement;
  let divs: Record<string, Element> = {};

  function updateLegend() {
    console.log('updateLegend');

    const ols = Object.keys($overlays);
    const ol = $sOverlay;
    for (const uid of Object.keys(divs)) {
      if (!ols.includes(uid)) {
        div.removeChild(divs[uid]);
        delete divs[uid];
      }
    }

    if (divs[ol]) {
      div.removeChild(divs[ol]);
      delete divs[ol];
    }

    divs[ol] = document.createElement('div');
    div.appendChild(divs[ol]);

    const ks = $overlays[ol].currLegend;
    let elem: Element;
    if (ks) {
      elem = Plot.legend({
        color: {
          domain: ks.map((x) => `${x}`.toString()) // Convert null to string
        },
        legend: 'swatches',
        className: 'alphabet',
        style: {
          fontSize: '13px'
        }
      });
    } else {
      elem = Plot.legend({
        color: {
          interpolate: d3.interpolateTurbo,
          domain: [$sFeatureData.minmax[0], $sFeatureData.minmax[1]]
        },
        width: 250,
        ticks: 5,
        label: $overlays[ol].currUnit,
        // height: 30,
        // marginTop: -5,
        className: 'colorbar',
        style: {
          'background-color': 'transparent',
          fontSize: '10px'
        }
      });
    }

    const name = document.createElement('div');
    name.classList.add('legend-name');
    if (!ks) {
      name.style.marginBottom = '-14px';
    }
    name.innerText = $overlays[ol].currFeature!.feature;
    divs[ol].prepend(name);
    divs[ol].appendChild(elem);
    div.appendChild(divs[ol]);
  }

  $: if (div && $sEvent?.type === 'featureUpdated' && $sFeatureData) {
    updateLegend();
  }
</script>

<div bind:this={div} />

<style lang="postcss">
  div :global(.alphabet) {
    @apply mt-2 flex flex-col items-end gap-0.5;
  }

  div :global(.alphabet-swatch) {
    @apply -mr-1 inline-flex flex-row-reverse justify-end gap-x-1;
  }

  div :global(.legend-name) {
    @apply text-end text-sm font-medium text-neutral-50;
  }
</style>
