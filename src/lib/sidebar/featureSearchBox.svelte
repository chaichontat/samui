<script lang="ts">
  import { Fzf } from 'fzf';
  import { cubicOut } from 'svelte/easing';
  import { fade } from 'svelte/transition';
  import { oneLRU } from '../lru';
  import { hoverSelect, overlaysFeature, setHoverSelect, sOverlay } from '../store';
  import { clickOutside } from '../ui/utils';
  import HoverableFeature from './hoverableFeature.svelte';
  import type { FeatureGroupList } from './searchBox';

  let fzf: [string | undefined, Fzf<readonly string[]>][];

  export let featureGroup: FeatureGroupList[];

  let showSearch = false;
  const firstTime = true;

  let search = '';
  let candidates: {
    group: string;
    values: { group: string; feature: string; embellished: string }[];
  }[] = [];

  function highlightChars(str: string, indices: Set<number>): string {
    const chars = str.split('');
    return chars.map((c, i) => (indices.has(i) ? `<b>${c}</b>` : c)).join('');
  }

  $: if (featureGroup) {
    fzf = featureGroup.map((f) => [
      f.group,
      new Fzf(f.features, { limit: 6, casing: 'case-insensitive' })
    ]);
  }

  $: if (fzf) {
    candidates = [];
    for (const [group, fz] of fzf) {
      const res = fz.find(search);
      candidates.push({
        group: group ?? 'nogroups',
        values: res.map((x) => ({
          group: group ?? 'nogroups',
          feature: x.item,
          embellished: highlightChars(x.item, x.positions)
        }))
      });
    }
  }

  // Top-down update of the search box.
  const setSearch = oneLRU((v: string) => (search = v));
  $: !firstTime && $hoverSelect.selected?.feature && setSearch($hoverSelect.selected?.feature);

  $: noFeature = !featureGroup?.length || featureGroup.find((f) => f.features.length) == undefined;

  // Change search box when overlay is changed.
  sOverlay.subscribe((ov) => {
    if (ov && !firstTime) search = $overlaysFeature[ov]?.feature ?? '';
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
    }}
    on:input={() => (showSearch = true)}
    placeholder={noFeature ? 'No feature' : 'Search features'}
    disabled={noFeature}
  />

  <!-- Search results -->
  {#if showSearch}
    <!-- See clickOutside for on:outclick. -->
    <div
      out:fade={{ duration: 100, easing: cubicOut }}
      class="bg-default absolute top-12 z-40 flex w-full flex-col gap-y-1 rounded-lg px-2 pt-2 pb-4 shadow shadow-white"
      use:clickOutside
      on:click={() => (showSearch = false)}
      on:outclick={() => (showSearch = false)}
      on:mouseout={() => setHoverSelect({ hover: undefined })}
      on:blur={() => setHoverSelect({ hover: undefined })}
    >
      {#each candidates as { group, values }}
        {#if values.length > 0}
          <div class="flex flex-col">
            <span class="px-2 pt-1.5 pb-0.5 font-medium capitalize text-yellow-300">
              {group ?? 'Misc.'}
            </span>
            {#each values as v}
              <HoverableFeature
                feature={v}
                class="hover-default cursor-pointer rounded px-4 py-0.5 text-left text-base"
              >
                {@html v.embellished}
              </HoverableFeature>
            {/each}
          </div>
        {/if}
      {/each}

      {#if candidates.length === 0}
        <i class="py-1 px-3 text-neutral-300">No features found.</i>
      {/if}
    </div>
  {/if}
</div>

<style lang="postcss">
  .dark input::placeholder {
    @apply text-neutral-100;
  }
</style>
