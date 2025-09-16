<!-- Nav of sidebar. -->
<script lang="ts">
  import { allFeatures, mapIdSample, samples, sMapId } from '$lib/store';
  import Github from '../components/github.svelte';
  import FeatureSearchBox from './searchbox/featureSearchBox.svelte';

  $: sample = $samples.find((x) => x.name === $mapIdSample[$sMapId])?.sample;
  $: if (sample) {
    (async () => {
      await sample.promise;
      $allFeatures = await sample.genFeatureList();
    })().catch(console.error);
  }
</script>

<nav class="flex items-center gap-x-3 bg-neutral-900 px-3 pt-4 pb-3 text-mb backdrop-blur">
  <div class="flex-grow">
    <FeatureSearchBox featureGroup={$allFeatures} />
  </div>
  <!-- <Darkswitch /> Will be back! -->
  <Github />
</nav>
