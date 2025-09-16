<script lang="ts">
  import { annoFeat, annoHover, mask, sEvent, sFeatureData, sId, sMapp, sSample } from '$lib/store';
  import PlotSearchBox from './PlotSearchBox.svelte';

  let width = 160;
  let height = 60;
  let amount: Record<string, number[]> | undefined;

  $: if (
    $sEvent?.type === 'featureUpdated' ||
    $sEvent?.type === 'sampleUpdated' ||
    $sEvent?.type === 'pointsAdded'
  ) {
    amount = $annoFeat.keys.length
      ? $sMapp.persistentLayers.annotations.points.getAllPointsByLabel()
      : undefined;
    // Each gene.
  }

  const templates = [
    { group: 'genes', feature: 'SNAP25' },
    { group: 'genes', feature: 'MOBP' },
    { group: 'genes', feature: 'PCP4' },
    { group: 'genes', feature: 'HBB' }
  ];
</script>

<table
  class="w-full table-auto border-separate border-spacing-x-1 relative max-w-[600px] overflow-visible border-spacing-y-1"
>
  {#each templates as fg, i}
    <tr class="">
      <PlotSearchBox {fg} genAxis={i === templates.length - 1} {amount} {width} {height} />
    </tr>
  {/each}
</table>

<style lang="postcss">
  @reference "$css"
  :global(.axisX path) {
    stroke: #888;
  }
</style>
