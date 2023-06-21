<script lang="ts">
  import {
    Listbox,
    ListboxButton,
    ListboxOption,
    ListboxOptions
  } from '@rgossiaux/svelte-headlessui';
  import { oneLRU } from '../../lru';
  import { hoverSelect, overlaysFeature, sOverlay, setHoverSelect } from '../../store';
  import type { FeatureGroupList } from '../searchBox';
  import SearchList from './SearchList.svelte';

  import { ChevronDown } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';

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

  let groups: string[] | undefined = [];
  let selectedGroup = groups[0];
  $: {
    groups = featureGroup?.map((f) => f.group ?? 'Misc.');
    if (!selectedGroup && groups && groups.length) selectedGroup = groups[0];
  }
</script>

<div class="flex gap-x-1 w-full">
  {#if featureGroup && featureGroup.length > 1}
    <Listbox
      bind:value={selectedGroup}
      class="relative cursor-pointer overflow-visible max-w-[35%]"
    >
      <span class="inline-block w-full rounded-md shadow-sm">
        <ListboxButton
          class="relative w-full py-2 pl-3 pr-8 text-left transition duration-150 ease-in-out bg-neutral-800 border border-neutral-400 rounded-md focus:outline-none focus:shadow-outline-blue focus:border-blue-300 "
        >
          <span class="block truncate">{selectedGroup}</span>
          <span class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <Icon class="w-4 h-4 translate-y-[0.25] text-neutral-400" src={ChevronDown} />
          </span>
        </ListboxButton>
      </span>

      <div
        class="absolute mt-1 bg-neutral-800 rounded-md overflow-visible shadow-lg shadow-neutral-600/50 border border-neutral-200/30"
      >
        <ListboxOptions>
          <div class="py-1">
            {#each groups as group}
              <ListboxOption
                value={group}
                class="bg-neutral-800 hover:bg-neutral-700 py-1 px-3 rounded-md"
              >
                {group}
              </ListboxOption>
            {/each}
          </div>
        </ListboxOptions>
      </div>
    </Listbox>
  {/if}

  <input
    type="text"
    class="w-full rounded-md border border-neutral-400 bg-neutral-100 py-[5px] px-3 shadow transition-colors dark:border-neutral-600 dark:bg-neutral-800"
    bind:value={search}
    on:click={(ev) => {
      ev.currentTarget.select();
      showSearch = true;
      displaySelection = true;
      if (selectedGroup !== $hoverSelect.active?.group) search = '';
    }}
    on:input={() => (showSearch = true)}
    placeholder={noFeature ? 'No feature' : 'Search features'}
    disabled={noFeature}
  />

  <SearchList {search} {selectedGroup} bind:showSearch {featureGroup} set={setHoverSelect} />
</div>

<style lang="postcss">
  .dark input::placeholder {
    @apply text-neutral-100;
  }
</style>
