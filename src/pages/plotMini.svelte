<script lang="ts">
  import { annoFeat, annoHover, mask, sEvent, sFeatureData, sId, sMapp, sSample } from '$lib/store';
  import type { FeatureAndGroup } from '$src/lib/data/objects/feature';
  import HoverableFeature from '$src/lib/sidebar/hoverableFeature.svelte';
  import * as d3 from 'd3';
  import { isEqual, throttle, zip } from 'lodash-es';
  import colors from 'tailwindcss/colors';
  import RidgelineChart from './ridgeline';
  let hs: RidgelineChart[] = [];
  let width = 160;
  let height = 60;

  async function updateData(amount?: Record<string, number[]>) {
    // Each section/gene.
    for (const [i, [fg, node]] of zip(items, divs).entries()) {
      const ret = await $sSample.getFeature(fg!);
      if (!ret) {
        console.error('Failed to get feature', fg);
        continue;
      }
      const { data } = ret;
      let toSend = [data as number[]]; // Full dataset.
      // Each label.

      $annoFeat.keys.forEach((key) => {
        const idxs = amount![key];
        if (!idxs) return;
        toSend.push(idxs.map((l) => data[l] as number));
      });
      // $annoFeat.keys.forEach((k) => {
      //   const idxs = amount![k];
      //   if (!idxs) return;
      //   toSend.push(idxs.map((j) => data[j]));
      // });

      if (!hs[i]) hs.push(new RidgelineChart(node, width, height, 5, 10, [0, 10]));
      const h = hs[i];
      h.genXAxis(i !== items.length - 1);
      h.genArea(
        fg?.feature,
        toSend,
        ['url(#grad)'].concat(d3.schemeTableau10.slice(0, $annoFeat.keys.length))
      );
    }
  }

  $: if (
    (divs[0] && ($sEvent?.type === 'featureUpdated' || $sEvent?.type === 'sampleUpdated')) ||
    $sEvent?.type === 'pointsAdded'
  ) {
    const amount = $annoFeat.keys.length
      ? $sMapp.persistentLayers.annotations.points.getAllPointsByLabel()
      : undefined;
    // Each gene.
    updateData(amount).catch(console.error);
  }

  $: hs.forEach((h) => h.highlight($annoHover == undefined ? undefined : $annoHover + 1));

  const items = [
    { group: 'genes', feature: 'SNAP25' },
    { group: 'genes', feature: 'MOBP' },
    { group: 'genes', feature: 'PCP4' },
    { group: 'genes', feature: 'HBB' }
  ];
  const divs = new Array(items.length);
</script>

<!--
<button
  class="h-4 w-4"
  on:click={() => {
    $mask = $sFeatureData?.data.map((v) => v > 2 - Math.random() && v < 4 + 2 * Math.random() - 1);
    $sEvent = { type: 'maskUpdated' };
  }}>Hi</button
> -->

<table
  class="table-auto border-separate border-spacing-x-2 relative max-w-[600px] overflow-visible border-spacing-y-4"
>
  {#each items as it, i}
    <tr class="">
      <td class="p-0 pr-3 text-yellow-300 text-right text-xs">
        <HoverableFeature feature={it} />
      </td>
      <td class="p-0">
        <div class="">
          <svg bind:this={divs[i]} height={i === items.length - 1 ? height + 15 : height} {width} />
        </div>
        <!-- class="overflow-visible" -->
      </td>
    </tr>
  {/each}
</table>

<style lang="postcss">
  :global(.axisX path) {
    stroke: #888;
  }
</style>
