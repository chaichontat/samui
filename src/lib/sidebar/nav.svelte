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

<nav class="flex items-center gap-x-3 bg-neutral-900 px-3 pt-4 pb-3 text-mb backdrop-blur">
  <div class="flex-grow">
    <FeatureSearchBox {featureGroup} />
  </div>
  <!-- <Darkswitch /> Will be back! -->
  <Github />
</nav>
