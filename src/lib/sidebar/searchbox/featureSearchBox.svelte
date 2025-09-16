<script lang="ts">
  import { Select } from 'bits-ui';
  import { oneLRU } from '../../lru';
  import { hoverSelect, overlaysFeature, sOverlay, setHoverSelect } from '../../store';
  import { classes } from '../../utils';
  import type { FeatureGroupList } from '../searchBox';
  import SearchList from './SearchList.svelte';
  import {
    buildGroupMeta,
    deriveSearchInput,
    hasAvailableFeatures,
    overlaySelectionFeature
  } from './state';

  import { ChevronDown } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';

  export let featureGroup: FeatureGroupList[] | undefined;
  export let displaySelection = false; // Start with empty search box.
  export let onSelect = setHoverSelect;

  // Top-down update of the search box.
  let showSearch = false;
  let search = '';
  const setSearch = oneLRU((v: string) => (search = v));
  $: search = deriveSearchInput({
    showSearch,
    displaySelection,
    selected: $hoverSelect.selected,
    previous: search
  });
  $: noFeature = !hasAvailableFeatures(featureGroup);

  // Change search box when overlay is changed.
  sOverlay.subscribe((ov) => {
    if (ov) search = overlaySelectionFeature($overlaysFeature, ov, search);
  });

  let groups: string[] = [];
  let selectItems: { value: string; label: string }[] = [];
  let selectedGroup = '';
  $: ({ groups, selectItems, selectedGroup } = buildGroupMeta(featureGroup, selectedGroup));
</script>

<div class="flex gap-x-1 w-full">
  {#if featureGroup && featureGroup.length > 1}
    <div class="relative cursor-pointer overflow-visible max-w-[35%]">
      <Select.Root type="single" bind:value={selectedGroup} items={selectItems}>
        <span class="inline-block w-full rounded-md shadow-sm">
          <Select.Trigger
            class="relative w-full py-2 pl-3 pr-8 text-left transition duration-150 ease-in-out bg-neutral-800 border border-neutral-400 rounded-md focus:outline-none focus:shadow-outline-blue focus:border-blue-300"
            data-testid="feature-search-group"
          >
            <span class="block truncate">{selectedGroup}</span>
            <span class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <Icon class="w-4 h-4 translate-y-[0.25] text-neutral-400" src={ChevronDown} />
            </span>
          </Select.Trigger>
        </span>

        <Select.Portal>
          <Select.Content forceMount side="bottom" align="start" sideOffset={4} class="z-50">
            {#snippet child({ wrapperProps, props, open })}
              {#if open}
                {@const { class: rawContentClass, ...contentRest } = props}
                {@const contentClass: string | undefined =
                  typeof rawContentClass === 'string' ? rawContentClass : undefined}
                <div {...wrapperProps}>
                  <div
                    {...contentRest}
                    class={classes(
                      contentClass,
                      'mt-1 rounded-md border border-neutral-200/30 bg-neutral-800 shadow-lg shadow-neutral-600/50'
                    )}
                  >
                    <Select.Viewport class="py-1">
                      {#each groups as group}
                        <Select.Item value={group} label={group}>
                          {#snippet children({ selected, highlighted })}
                            <div
                              class={classes(
                                'cursor-pointer rounded-md py-1 px-3 text-left focus:outline-none hover:bg-neutral-700',
                                selected ? 'font-medium' : '',
                                highlighted ? 'bg-neutral-700' : 'bg-neutral-800'
                              )}
                            >
                              {group}
                            </div>
                          {/snippet}
                        </Select.Item>
                      {/each}
                    </Select.Viewport>
                  </div>
                </div>
              {/if}
            {/snippet}
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
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
    data-testid="feature-search-input"
  />

  <SearchList {search} {selectedGroup} bind:showSearch {featureGroup} set={onSelect} />
</div>

<style lang="postcss">
  @reference "$css"
  .dark input::placeholder {
    @apply text-neutral-100;
  }
</style>
