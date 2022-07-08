<script lang="ts">
  import Darkswitch from './components/darkswitch.svelte';
  import Github from './components/github.svelte';
  import SampleList from './components/sampleList.svelte';
  import SearchBox from './components/searchBox.svelte';
  import type { NameWithFeature } from './data/features';
  import { HoverSelect, updateNames, type FeatureNamesGroup } from './data/searchBox';
  import { activeFeatures, activeOverlay, sample } from './store';

  let active: HoverSelect<NameWithFeature>;
  $: if (active?.active) {
    $activeFeatures[$activeOverlay] = active.active;
    console.log($activeFeatures);
  }
  let names: FeatureNamesGroup[];
  $: {
    if ($sample) {
      updateNames($sample.features, $activeOverlay)
        .then((v) => (names = v))
        .catch(console.error);
    }
  }

  activeOverlay.subscribe((v: string) => {
    if (!active) return;
    active.selected = $activeFeatures[v];
  });
</script>

<nav class="flex items-center gap-x-3 bg-gray-100 py-3 px-6 shadow backdrop-blur dark:bg-gray-900">
  <!-- <div class="over mt-2 text-ellipsis text-xl font-medium">Showing <i>{$currRna.name}</i>.</div> -->
  <div class="gap-x-2 pt-1 text-base">
    <SampleList
      items={$sample ? Object.keys($sample.overlays) : []}
      bind:active={$activeOverlay}
      loading={false}
      showArrow={false}
      addSample={false}
      useSpinner={false}
    />
  </div>
  <div class="mt-1  flex-grow">
    <SearchBox featureNamesGroup={names} bind:curr={active} />
  </div>
  <Darkswitch />
  <Github />
</nav>
