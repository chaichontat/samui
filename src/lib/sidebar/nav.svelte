<!-- Nav of sidebar. -->
<script lang="ts">
  import FeatureSearchBox from '$lib/components/featureSearchBox.svelte';
  import { mapIdSample, samples, sFeature, sMapId, sOverlay } from '$lib/store';
  import Darkswitch from '../components/darkswitch.svelte';
  import Github from '../components/github.svelte';
  import type { FeatureAndGroup } from '../data/objects/feature';
  import type { FeatureGroupList, HoverSelect } from '../data/searchBox';
  // Feature list
  let featureGroup: FeatureGroupList[];
  $: sample = $samples[$mapIdSample[$sMapId]];
  $: if (sample) {
    (async () => {
      await sample.promise;
      featureGroup = sample.genFeatureList();
    })().catch(console.error);
  }

  // Set feature
  let currFeature: HoverSelect<FeatureAndGroup>;

  // Need to use this function in order to prevent update when $sOverlay is changed.
  const setFeature = (cf: typeof currFeature) => ($sFeature[$sOverlay] = cf.active);
  $: if (sample) setFeature(currFeature);
</script>

<nav class="flex items-center gap-x-3 bg-gray-100 py-3 shadow backdrop-blur dark:bg-gray-900">
  <div class="mt-1 flex-grow">
    <FeatureSearchBox {featureGroup} bind:curr={currFeature} />
  </div>
  <Darkswitch />
  <Github />
</nav>
