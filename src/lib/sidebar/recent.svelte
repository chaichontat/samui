<script lang="ts">
  import { setHoverSelect, sFeature } from '$lib/store';
  import { isEqual } from 'lodash-es';
  import type { FeatureAndGroup } from '../data/objects/feature';
  import { clickOutside } from '../ui/utils';

  export let maxLength = 6;

  let queue = [] as FeatureAndGroup[];

  $: if ($sFeature && !queue.find((x) => isEqual($sFeature, x))) {
    console.log('recent', $sFeature);
    queue.push($sFeature);
    if (queue.length > maxLength) queue.shift();
    queue = queue;
  }
</script>

{#each queue as feature}
  <ol class="ml-4">
    <li
      class="w-[1%] cursor-pointer font-semibold leading-8 text-yellow-300/90"
      use:clickOutside
      on:mouseover={() => setHoverSelect({ hover: feature })}
      on:focus={() => setHoverSelect({ hover: feature })}
      on:mouseout={() => setHoverSelect({ hover: undefined })}
      on:blur={() => setHoverSelect({ hover: undefined })}
      on:click={() => setHoverSelect({ selected: feature })}
    >
      <button>{feature.feature}</button>
    </li>
  </ol>
{/each}
