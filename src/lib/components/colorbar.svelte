<script lang="ts">
  import { hoverSelect, overlays, sFeature, sOverlay } from '$lib/store';
  import * as Plot from '@observablehq/plot';
  import * as d3 from 'd3';
  import { onMount } from 'svelte';
  import { Legend } from './legend';
  export let color = 'viridis' | 'turbo';

  let svg: SVGSVGElement;
  let div: HTMLDivElement;

  let divs: Record<string, Element> = {};

  // onMount(() => {
  //   Legend(
  //     d3.select(svg),
  //     d3.scaleSequential(
  //       [min, max],
  //       // @ts-ignore
  //       // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  //       d3[`interpolate${color.charAt(0).toUpperCase() + color.slice(1)}`]
  //     ),
  //     {
  //       title,
  //       legendAnchor: 'end'
  //     }
  //   );
  // });

  function updateLegend() {
    const ol = $sOverlay;
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
          domain: ks.map((x) => x.toString())
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
          domain: [0, 10]
        },
        width: 250,
        ticks: 5,
        label: 'Log Normalized',
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

  onMount(() => {
    document.addEventListener('updatedFeature', updateLegend);
  });

  // $: d3.select(svg).select('image').attr('opacity', opacity);
</script>

<!-- <svg bind:this={svg} /> -->
<div bind:this={div} />

<style lang="postcss">
  div :global(.alphabet) {
    @apply mt-2 flex flex-col items-end gap-0.5;
  }

  div :global(.alphabet-swatch) {
    @apply -mr-1 inline-flex flex-row-reverse justify-end gap-x-1;
  }

  div :global(.legend-name) {
    @apply text-end text-base font-medium text-slate-50;
  }
</style>
