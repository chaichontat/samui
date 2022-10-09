<script lang="ts">
  import { annoFeat, mask, sEvent, sFeatureData, sId, sMapp, sSample } from '$lib/store';
  import type { FeatureAndGroup } from '$src/lib/data/objects/feature';
  import * as d3 from 'd3';
  import { isEqual, throttle, zip } from 'lodash-es';

  import RidgelineChart from './ridgeline';

  let hs: RidgelineChart[] = [];

  $: if (
    (divs[0] && ($sEvent?.type === 'featureUpdated' || $sEvent?.type === 'sampleUpdated')) ||
    $sEvent?.type === 'pointsAdded'
  ) {
    const isLabel = $annoFeat.keys.length;
    const amount = isLabel
      ? $sMapp.persistentLayers.annotations.points.getAllPointsByLabel()
      : undefined;
    for (const [i, [fg, node]] of zip(items, divs).entries()) {
      if (!hs[i]) {
        hs.push(new RidgelineChart(node, 160, 40, 10, [0, 10]));
      }
      const h = hs[i];
      $sSample.getFeature(fg!).then(({ data }) => {
        let toSend;
        if (isLabel) {
          toSend = $annoFeat.keys.map((k) => {
            const idxs = amount![k];
            if (!idxs) return;
            return idxs.map((j) => data[j]);
          });
        } else {
          toSend = [data];
        }
        h.genArea(
          toSend,
          Array.from({ length: toSend.length }, (_, i) => d3.schemeTableau10[i])
        );
        if (i === items.length - 1) {
          h.genXAxis();
        }
      });
    }
  }

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
  class="table-auto border-separate border-spacing-x-3 border-spacing-y-1 relative max-w-[600px] overflow-y-visible py-2"
>
  {#each items as it, i}
    <tr>
      <td>{`${it.feature}`}</td>
      <td>
        <div class="">
          <svg bind:this={divs[i]} class="overflow-visible" height="40px" width="160px" />
        </div>
      </td>
    </tr>
  {/each}
</table>

<style lang="postcss">
  :global(.axisX path) {
    stroke: #888;
  }
</style>
