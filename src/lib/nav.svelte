<!-- Nav of sidebar. -->
<script lang="ts">
  import Darkswitch from './components/darkswitch.svelte';
  import Github from './components/github.svelte';
  import List from './components/list.svelte';
  import SearchBox from './components/searchBox.svelte';
  import type { FeatureAndGroup } from './data/features';
  import type { FeatureGroupList, HoverSelect } from './data/searchBox';
  import { sFeature, sOverlay, sSample } from './store';
  import { oneLRU } from './utils';

  // Overlay
  let currOverlay: string;
  $: if ($sSample && currOverlay) {
    $sOverlay = currOverlay;
  }

  // Features
  let featureGroup: FeatureGroupList[];
  $: if ($sSample && $sOverlay) featureGroup = $sSample.overlays[$sOverlay].featNames;

  let currFeature: HoverSelect<FeatureAndGroup>;
  const updateFeature = oneLRU((cf: typeof currFeature) => ($sFeature[$sOverlay] = cf.active!));

  $: if ($sSample && currFeature?.active) updateFeature(currFeature);

  // const setSelected = oneLRU((ov: string) => {
  //   if (!active) return;
  //   active.selected = $features[ov];
  // });

  // focus.subscribe((f) => setSelected(f.overlay));
</script>

<nav class="flex items-center gap-x-3 bg-gray-100 py-3 px-6 shadow backdrop-blur dark:bg-gray-900">
  <!-- Overlay selector -->
  <div class="gap-x-2 pt-1 text-base">
    <List
      items={$sSample ? Object.keys($sSample.overlays) : []}
      bind:active={currOverlay}
      loading={false}
      showArrow={false}
      addSample={false}
      useSpinner={false}
    />
  </div>

  <!-- Search features -->
  <div class="mt-1 flex-grow">
    <SearchBox {featureGroup} bind:curr={currFeature} />
  </div>
  <Darkswitch />
  <Github />
</nav>
