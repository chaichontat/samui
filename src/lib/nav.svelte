<!-- Nav of sidebar. -->
<script lang="ts">
  import Darkswitch from './components/darkswitch.svelte';
  import Github from './components/github.svelte';
  import List from './components/list.svelte';
  import SearchBox from './components/searchBox.svelte';
  import type { FeatureAndGroup } from './data/features';
  import { HoverSelect, updateNames, type FeatureGroupList } from './data/searchBox';
  import { features, focus, sample } from './store';
  import { oneLRU } from './utils';

  let active: HoverSelect<FeatureAndGroup>;
  $: if (active?.active) {
    $features[$focus.overlay] = active.active;
    console.log($features);
  }
  let names: FeatureGroupList[];
  $: {
    if ($sample) {
      updateNames($sample.features, $focus.overlay)
        .then((v) => (names = v))
        .catch(console.error);
    }
  }

  const setSelected = oneLRU((ov: string) => {
    if (!active) return;
    active.selected = $features[ov];
  });

  focus.subscribe((f) => setSelected(f.overlay));
</script>

<nav class="flex items-center gap-x-3 bg-gray-100 py-3 px-6 shadow backdrop-blur dark:bg-gray-900">
  <!-- Overlay selector -->
  <div class="gap-x-2 pt-1 text-base">
    <List
      items={$sample ? Object.keys($sample.overlays) : []}
      bind:active={$focus.overlay}
      loading={false}
      showArrow={false}
      addSample={false}
      useSpinner={false}
    />
  </div>
  <div class="mt-1 flex-grow">
    <SearchBox featureGroup={names} bind:curr={active} />
  </div>
  <Darkswitch />
  <Github />
</nav>
