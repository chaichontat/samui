<script lang="ts">
  import * as d3 from 'd3';
  import { onMount } from 'svelte';
  import { Legend } from './legend';

  type Color = 'viridis' | 'turbo';
  export let color: Color = 'turbo';
  export let min: number;
  export let max: number;
  export let opacity = 1;
  export let title = '';
  export { cl as class };

  let cl = 'top-6 right-6';
  let svg: SVGSVGElement;

  onMount(() => {
    Legend(
      d3.select(svg),
      d3.scaleSequential(
        [min, max],
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        d3[`interpolate${color.charAt(0).toUpperCase() + color.slice(1)}`]
      ),
      {
        title,
        legendAnchor: 'end'
      }
    );
  });
</script>

<svg bind:this={svg} />
