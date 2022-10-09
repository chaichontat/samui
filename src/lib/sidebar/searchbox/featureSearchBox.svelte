<script lang="ts">
  import { oneLRU } from '../../lru';
  import { hoverSelect, overlaysFeature, setHoverSelect, sOverlay } from '../../store';
  import type { FeatureGroupList } from '../searchBox';
  import SearchList from './SearchList.svelte';

  export let featureGroup: FeatureGroupList[] | undefined;
  export let displaySelection = false; // Start with empty search box.

  // Top-down update of the search box.
  let showSearch = false;
  let search = '';
  const setSearch = oneLRU((v: string) => (search = v));
  $: !showSearch &&
    displaySelection &&
    $hoverSelect.selected?.feature &&
    setSearch($hoverSelect.selected?.feature);
  $: noFeature = !featureGroup?.length || featureGroup?.find((f) => f.features.length) == undefined;

  // Change search box when overlay is changed.
  sOverlay.subscribe((ov) => {
    if (ov) search = $overlaysFeature[ov]?.feature ?? '';
  });
</script>

<div class="relative w-full">
  <input
    type="text"
    class="w-full rounded-md border border-neutral-400 bg-neutral-100 py-[5px] px-3 shadow transition-colors dark:border-neutral-600 dark:bg-neutral-800"
    bind:value={search}
    on:click={(ev) => {
      ev.currentTarget.select();
      showSearch = true;
      displaySelection = true;
    }}
    on:input={() => (showSearch = true)}
    placeholder={noFeature ? 'No feature' : 'Search features'}
    disabled={noFeature}
  />

  <SearchList {search} bind:showSearch {featureGroup} set={setHoverSelect} />
</div>

<style lang="postcss">
  .dark input::placeholder {
    @apply text-neutral-100;
  }
</style>
