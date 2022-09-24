<script lang="ts">
  import { Fzf } from 'fzf';
  import { debounce } from 'lodash-es';
  import { cubicInOut, cubicOut } from 'svelte/easing';
  import { fade, slide } from 'svelte/transition';
  import type { FeatureAndGroup } from '../data/objects/feature';
  import { oneLRU } from '../lru';
  import { hoverSelect, overlaysFeature, setHoverSelect, sOverlay } from '../store';
  import { clickOutside } from '../ui/utils';
  import type { FeatureGroupList, HoverSelect } from './searchBox';

  let fzf: [string | undefined, Fzf<readonly string[]>][];

  export let featureGroup: FeatureGroupList[];

  let showSearch = true;

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
    fzf = featureGroup.map((f) => [f.group, new Fzf(f.features, { limit: 6 })]);
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
  $: $hoverSelect.selected?.feature && setSearch($hoverSelect.selected?.feature);
  $: noFeature = !featureGroup?.length || featureGroup.find((f) => f.features.length) === undefined;

  // Change search box when overlay is changed.
  sOverlay.subscribe((ov) => {
    if (ov) search = $overlaysFeature[ov]?.feature ?? '';
  });
</script>

<div class="relative w-full">
  <input
    type="text"
    class="w-full rounded-md border border-slate-400 bg-slate-100 py-[7px] px-4 shadow transition-colors dark:border-slate-600 dark:bg-slate-800"
    bind:value={search}
    on:click={() => (showSearch = true)}
    on:input={() => (showSearch = true)}
    placeholder={noFeature ? 'No feature' : 'Search features'}
    disabled={noFeature}
  />

  <!-- Search results -->
  {#if showSearch}
    <!-- See clickOutside for on:outclick. -->
    <div
      out:fade={{ duration: 100, easing: cubicOut }}
      class="bg-default absolute top-12 z-40 flex w-full flex-col gap-y-1 rounded-lg p-2 backdrop-blur"
      use:clickOutside
      on:outclick={() => (showSearch = false)}
      on:mouseout={() => setHoverSelect({ hover: undefined })}
      on:blur={() => setHoverSelect({ hover: undefined })}
    >
      {#each candidates as { group, values }}
        {#if values.length > 0}
          <div>
            <span class="px-2 py-1.5 font-medium capitalize text-yellow-300"
              >{group ?? 'Misc.'}</span
            >
            {#each values as v}
              <div
                class="hover-default cursor-pointer rounded px-4 py-1.5 text-base"
                on:mousemove={() =>
                  setHoverSelect({ hover: { group: v.group, feature: v.feature } })}
                on:click={() => {
                  setHoverSelect({
                    selected: { group: v.group, feature: v.feature }
                  });
                  showSearch = false;
                }}
                transition:slide={{ duration: 100, easing: cubicInOut }}
              >
                {@html v.embellished}
              </div>
            {/each}
          </div>
        {/if}
      {/each}

      {#if candidates.length === 0}
        <i class="py-1 px-3 text-slate-300">No features found.</i>
      {/if}
    </div>
  {/if}
</div>

<style lang="postcss">
  .dark input::placeholder {
    @apply text-slate-200;
  }
</style>
