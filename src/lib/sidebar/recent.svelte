<script lang="ts">
  import { hoverSelect, sFeature } from '$lib/store';
  import { isEqual } from 'lodash-es';
  import type { FeatureAndGroup } from '../data/objects/feature';
  import HoverableFeature from './hoverableFeature.svelte';

  export let maxLength = 6;

  let queue = [] as FeatureAndGroup[];

  $: if (
    $sFeature &&
    !queue.find((x) => isEqual($sFeature, x)) &&
    isEqual($sFeature, $hoverSelect.selected)
  ) {
    console.log('recent', $sFeature);
    queue.push($sFeature);
    if (queue.length > maxLength) queue.shift();
    queue = queue;
  }
</script>

<div class="flex flex-wrap gap-x-4">
  {#if queue.length > 0}
    {#each queue as feature}
      <HoverableFeature {feature} />
    {/each}
  {:else}
    <span class="mx-auto text-gray-400">No recent features (yet).</span>
  {/if}
</div>
