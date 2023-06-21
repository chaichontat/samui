<script lang="ts">
  import { allFeatures, type SimpleHS } from '$lib/store';
  import type { FeatureAndGroup } from '$src/lib/data/objects/feature';
  import { Fzf, type FzfResultItem } from 'fzf';
  import { createEventDispatcher } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { fade } from 'svelte/transition';
  import { clickOutside } from '../../ui/utils';
  import HoverableFeature from '../hoverableFeature.svelte';
  import type { FeatureGroupList } from '../searchBox';

  let fzf: [string | null, Fzf<readonly string[]>][];

  export let featureGroup: FeatureGroupList[] | undefined = $allFeatures;
  export let selectedGroup: string;
  export let showSearch = false;
  export let set:
    | ((v: SimpleHS<FeatureAndGroup>) => void)
    | ((v: SimpleHS<FeatureAndGroup>) => Promise<void>);
  export let search = '';
  export let limit = -1;

  const dispatch = createEventDispatcher();

  let cl =
    'bg-neutral-800/95 backdrop-blur-lg absolute top-12 z-40 flex w-[90%] flex-col gap-y-1 rounded-lg px-2 pt-2 mt-4 pb-2 shadow-lg shadow-neutral-600/50 border border-neutral-200/30';
  export { cl as class };

  let candidates: {
    group: string;
    values: { group: string; feature: string; embellished: string }[];
  }[] = [];

  function highlightChars(str: string, indices: Set<number>): string {
    const chars = str.split('');
    return chars.map((c, i) => (indices.has(i) ? `<b>${c}</b>` : c)).join('');
  }

  $: if (featureGroup) {
    fzf = featureGroup
      .filter((f) => f.group === selectedGroup)
      .map((f) => {
        const config: ConstructorParameters<typeof Fzf>[1] = {
          limit: 100,
          casing: 'case-insensitive'
        };
        if (f.weights) {
          config.tiebreakers = [
            (a: FzfResultItem<string>, b: FzfResultItem<string>) =>
              f.weights![f.names[a.item] - f.weights![f.names[b.item]]]
          ];
        }
        return [f.group, new Fzf(f.features, config)];
      });
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
</script>

<!-- Search results -->
<!-- {#if showSearch} -->
<!-- See clickOutside for on:outclick. -->
<!-- svelte-ignore a11y-click-events-have-key-events -->
<div
  out:fade={{ duration: 100, easing: cubicOut }}
  class={cl + ' max-h-96 overflow-y-auto'}
  class:hidden={!showSearch}
  use:clickOutside
  on:click={() => (showSearch = false)}
  on:outclick={() => {
    dispatch('outclick');
    showSearch = false;
  }}
  on:mouseout={() => set({ hover: undefined })}
  on:blur={() => set({ hover: undefined })}
  aria-label="Search result box"
>
  {#each candidates as { group, values }, i}
    {#if values.length > 0 && (limit < 0 || i < limit)}
      <div class="flex flex-col sticky">
        <!-- <span class="px-2 pt-1.5 pb-0.5 font-medium capitalize text-yellow-300">
          {group ?? 'Misc.'}
        </span> -->
        {#each values as v}
          <HoverableFeature
            {set}
            feature={v}
            class="hover-default text-ellipsis whitespace-nowrap cursor-pointer rounded px-4 py-0.5 text-left text-base"
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
<!-- {/if} -->
