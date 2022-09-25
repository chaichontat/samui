<script lang="ts">
  import { hoverSelect, overlays, sFeature } from '$lib/store';
  import * as Plot from '@observablehq/plot';
  import * as d3 from 'd3';
  import { onMount } from 'svelte';
  import { Legend } from './legend';

  type Color = 'viridis' | 'turbo';
  export let color: Color = 'turbo';
  export let min: number;
  export let max: number;
  export let opacity = 1;
  export let title = '';

  let svg: SVGSVGElement;
  let div: HTMLDivElement;

  let divs: Record<string, HTMLDivElement> = {};

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

  $: if ($overlays && $sFeature && $hoverSelect) {
    for (const ol of Object.keys($overlays)) {
      if (!divs[ol]) {
        divs[ol] = document.createElement('div');
        div.appendChild(divs[ol]);
      }

      const ks = $overlays[ol].currLegend;
      console.log(ks);
      if (ks) {
        const x: Element = Plot.legend({
          color: {
            domain: ks.map((x) => x.toString())
          },
          legend: 'swatches',
          className: 'alphabet',
          style: {
            fontSize: '13px'
          }
        });
        const name = document.createElement('div');
        name.classList.add('legend-name');
        name.innerText = $overlays[ol].currFeature?.feature;
        x.prepend(name);
        div.replaceChild(x, divs[ol]);
        divs[ol] = x;
      } else {
        div.removeChild(divs[ol]);
        delete divs[ol];
      }
    }
  }

  // $: d3.select(svg).select('image').attr('opacity', opacity);
</script>

<!-- <svg bind:this={svg} /> -->
<div class="pointer-events-none" bind:this={div} />

<style lang="postcss">
  div :global(.alphabet) {
    @apply mt-2 flex flex-col items-end gap-0.5;
  }

  div :global(.alphabet-swatch) {
    @apply -mr-1 inline-flex flex-row-reverse justify-end gap-x-1;
  }

  div :global(.legend-name) {
    @apply mb-1 text-base font-medium;
  }
</style>
