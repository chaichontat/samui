<!-- Nav of sidebar. -->
<script lang="ts">
  import { mapIdSample, samples, sMapId } from '$lib/store';
  import Darkswitch from '../components/darkswitch.svelte';
  import Github from '../components/github.svelte';
  import FeatureSearchBox from './featureSearchBox.svelte';
  import type { FeatureGroupList } from './searchBox';

  let featureGroup: FeatureGroupList[];
  $: sample = $samples[$mapIdSample[$sMapId]];
  $: if (sample) {
    (async () => {
      await sample.promise;
      featureGroup = await sample.genFeatureList();
    })().catch(console.error);
  }
</script>

<nav class="flex items-center gap-x-3 bg-gray-100 py-3 shadow backdrop-blur dark:bg-gray-900">
  <div class="mt-1 flex-grow">
    <FeatureSearchBox {featureGroup} />
  </div>
  <!-- <Darkswitch /> Will be back! -->
  <Github />
</nav>
