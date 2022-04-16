<script lang="ts">
  import { browser } from '$app/env';
  import { setVal } from '$src/lib/components/searchBox.svelte';
  import { onMount } from 'svelte';
  import embed from 'vega-embed';
  import type { VisualizationSpec } from 'vega-embed/src/embed';

  let hold = false;
  let div: HTMLDivElement;

  onMount(async () => {
    if (browser) {
      const spec = await fetch('/Br6522_Ant_IF/veg.json')
        .then((x) => x.json() as VisualizationSpec)
        .catch(console.error);
      // console.log(spec);
      spec.width = 72;
      spec.height = 400;

      await embed('#corr', spec, { tooltip: { theme: 'tooltip' } }).then(({ spec, view }) => {
        view.addEventListener('mouseover', (event, item) => {
          const gene = item?.datum?.Gene;
          if (gene) view._el.style.cursor = 'pointer';
          if (gene && !hold) setVal(gene);
        });

        view.addEventListener('mouseout', () => {
          view._el.style.cursor = 'default';
        });

        view.addEventListener('click', (event, item) => {
          const gene = item?.datum?.Gene;
          if (!gene) return;
          console.log(gene);
          setVal(gene);
          hold = true;
        });

        view.addEventListener('mouseleave', () => {
          hold = false;
        });
      });
    }
  });
</script>

<div id="corr" bind:this={div} class="h-[400px] w-full" />

<style lang="postcss">
  :global(#vg-tooltip-element.vg-tooltip.tooltip-theme) {
    @apply rounded-lg border border-gray-500 bg-gray-700/80 px-3 py-2 text-sm text-slate-50 shadow backdrop-blur;
  }

  :global(#vg-tooltip-element table tr td.key) {
    @apply text-slate-200;
  }

  :global(#vg-tooltip-element .value) {
    @apply font-medium italic  text-slate-50;
  }
</style>
