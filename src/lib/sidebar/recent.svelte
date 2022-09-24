<script lang="ts">
  import { sFeature } from '$lib/store';
  import { isEqual } from 'lodash-es';
  import type { FeatureAndGroup } from '../data/objects/feature';

  export let maxLength = 6;

  const queue = [] as FeatureAndGroup[];

  $: if (!isEqual($sFeature, queue.at(-1))) {
    console.log('recent', $sFeature);

    queue.push($sFeature);
    if (queue.length > maxLength) queue.shift();
  }
</script>

{#each queue as feature}
  <ol class="ml-4">
    <li class="cursor-pointer font-semibold" on:hover={() => {}}>
      <button>{feature.feature}</button>
    </li>
  </ol>
{/each}
