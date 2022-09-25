<script lang="ts">
  import { hoverSelect, setHoverSelect, sFeature } from '$lib/store';
  import { isEqual } from 'lodash-es';
  import type { FeatureAndGroup } from '../data/objects/feature';
  import { clickOutside } from '../ui/utils';

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
      <button
        class="cursor-pointer font-semibold text-yellow-300 hover:text-yellow-200"
        use:clickOutside
        on:mouseover={() => setHoverSelect({ hover: feature })}
        on:focus={() => setHoverSelect({ hover: feature })}
        on:mouseout={() => setHoverSelect({ hover: undefined })}
        on:blur={() => setHoverSelect({ hover: undefined })}
        on:click={() => setHoverSelect({ selected: feature })}>{feature.feature}</button
      >
    {/each}
  {:else}
    <span class="mx-auto text-gray-400">No recent features.</span>
  {/if}
</div>
