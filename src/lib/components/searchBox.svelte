<script lang="ts">
  import { clickOutside, oneLRU } from '$src/lib/utils';
  import { cubicInOut, cubicOut } from 'svelte/easing';
  import { fade, slide } from 'svelte/transition';
  import { Fzf } from '../../../node_modules/fzf';
  import type { FeatureAndGroup } from '../data/features';
  import { HoverSelect, type FeatureGroupList } from '../data/searchBox';

  let fzf: [string | undefined, Fzf<readonly string[]>][];

  export let featureGroup: FeatureGroupList[];
  export let curr = new HoverSelect<FeatureAndGroup>();

  let showSearch = true;

  let search = '';
  let candidates: {
    feature: string | undefined;
    values: { feature: string | undefined; raw: string; embellished: string }[];
  }[] = [];

  function highlightChars(str: string, indices: Set<number>): string {
    const chars = str.split('');
    return chars.map((c, i) => (indices.has(i) ? `<b>${c}</b>` : c)).join('');
  }

  const setVal = oneLRU(
    (v: { hover?: FeatureAndGroup | null; selected?: FeatureAndGroup | null }) => {
      curr.update(v);
      curr = curr;
    }
  );

  $: if (featureGroup) {
    fzf = featureGroup.map((f) => [f.group, new Fzf(f.features, { limit: 6 })]);
  }

  $: if (fzf) {
    candidates = [];
    for (const [feature, fz] of fzf) {
      const res = fz.find(search);
      candidates.push({
        feature,
        values: res.map((x) => ({
          feature,
          raw: x.item,
          embellished: highlightChars(x.item, x.positions)
        }))
      });
    }
  }

  // Top-down update of the search box.
  const setSearch = oneLRU((v: string) => (search = v));
  $: curr.selected?.feature && setSearch(curr.selected?.feature);

  $: noFeature = !featureGroup?.length || featureGroup.find((f) => f.features.length) === undefined;
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

  {#if showSearch}
    <!-- See clickOutside for on:outclick. -->
    <div
      out:fade={{ duration: 100, easing: cubicOut }}
      class="bg-default absolute top-12 z-40 flex w-full flex-col gap-y-1 rounded-lg p-2 backdrop-blur"
      use:clickOutside
      on:outclick={() => (showSearch = false)}
      on:mouseout={() => setVal({ hover: null })}
      on:blur={() => setVal({ hover: null })}
    >
      {#each candidates as { feature, values }}
        {#if values.length > 0}
          <div>
            <span class="px-2 py-1.5 font-medium capitalize text-yellow-300"
              >{feature ?? 'Misc.'}</span
            >
            {#each values as v}
              <div
                class="hover-default cursor-pointer rounded px-4 py-1.5 text-base"
                on:mousemove={() => setVal({ hover: { group: v.feature, feature: v.raw } })}
                on:click={() => {
                  showSearch = false;
                  setVal({ selected: { group: v.feature, feature: v.raw } });
                }}
                transition:slide={{ duration: 100, easing: cubicInOut }}
              >
                {@html v.embellished}
              </div>
            {/each}
          </div>
        {/if}
      {/each}

      <!-- {#if candidates.length === 0}
        <i class="py-1 px-3 text-slate-300">No genes found.</i>
      {/if} -->
    </div>
  {/if}
</div>

<style lang="postcss">
  .dark input::placeholder {
    @apply text-slate-200;
  }
</style>
