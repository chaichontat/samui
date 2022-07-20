<script lang="ts">
  import Darkswitch from './components/darkswitch.svelte';
  import Github from './components/github.svelte';
  import List from './components/list.svelte';
  import SearchBox from './components/searchBox.svelte';
  import type { NameWithFeature } from './data/features';
  import { HoverSelect, updateNames, type FeatureNamesGroup } from './data/searchBox';
  import { features, focus, sample } from './store';
  import { oneLRU } from './utils';

  let active: HoverSelect<NameWithFeature>;
  $: if (active?.active) {
    $features[$focus.overlay] = active.active;
    console.log($features);
  }
  let names: FeatureNamesGroup[];
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
  <!-- <div class="over mt-2 text-ellipsis text-xl font-medium">Showing <i>{$currRna.name}</i>.</div> -->
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
  <div class="mt-1  flex-grow">
    <SearchBox featureNamesGroup={names} bind:curr={active} />
  </div>
  <Darkswitch />
  <Github />
</nav>
