<script lang="ts">
  import { hoverSelect, setHoverSelect, sSample } from '$lib/store';
  import { isEqual } from 'lodash-es';
  import type { FeatureAndGroup } from '../data/objects/feature';
  import HoverableFeature from './hoverableFeature.svelte';

  export let maxLength = 6;

  let queue = [] as FeatureAndGroup[];
  let lastSampleName: string | undefined;
  let skipNextSelection = false;

  $: currentSampleName = $sSample?.name;
  $: {
    if (currentSampleName !== lastSampleName) {
      const hadItems = queue.length > 0;
      queue = [];
      lastSampleName = currentSampleName;
      skipNextSelection = hadItems;
    }
  }

  $: if ($hoverSelect.selected && !queue.find((x) => isEqual($hoverSelect.selected, x))) {
    if (skipNextSelection) {
      skipNextSelection = false;
    } else {
      queue.push($hoverSelect.selected);
      if (queue.length > maxLength) queue.shift();
      queue = queue;
    }
  }
</script>

<div class="flex flex-wrap gap-x-4">
  {#if queue.length > 0}
    {#each queue as feature}
      <HoverableFeature {feature} set={setHoverSelect} />
    {/each}
  {:else}
    <span class="mx-auto text-neutral-400">No recent features (yet).</span>
  {/if}
</div>
