<script lang="ts">
  import { clickOutside, oneLRU } from '$src/lib/utils';
  import { cubicInOut, cubicOut } from 'svelte/easing';
  import { fade, slide } from 'svelte/transition';
  import { Fzf } from '../../../node_modules/fzf';
  import type { NameWithFeature } from '../data/features';
  import { genHoverName, type HoverName, type NameWithFeatures } from '../store';

  type Name = NameWithFeature;
  let fzf: [string | undefined, Fzf<readonly string[]>][];

  export let overlayFilter: string;
  export let names: NameWithFeatures[];
  export let curr: HoverName<Name>;
  curr = genHoverName<Name>({});

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

  const setVal = oneLRU(({ hover, selected }: { hover?: Name | null; selected?: Name | null }) => {
    if (hover !== undefined) curr.hover = hover;
    if (selected !== undefined) {
      curr.selected = selected;
      search = selected!.name;
    }
  });

  $: if (names) {
    fzf = names.map((f) => [f.feature, new Fzf(f.names, { limit: 6 })]);
  }

  $: if (fzf) {
    candidates = [];
    for (const [f, fz] of fzf) {
      const res = fz.find(search);
      candidates.push({
        feature: f,
        values: res.map((x) => ({
          feature: f,
          raw: x.item,
          embellished: highlightChars(x.item, x.positions)
        }))
      });
    }
  }
</script>

<div class="relative w-full">
  <input
    type="text"
    class="w-full rounded-md border border-slate-400 bg-slate-100 py-[7px] px-4 shadow transition-colors dark:border-slate-600 dark:bg-slate-800"
    bind:value={search}
    on:click={() => (showSearch = true)}
    on:input={() => (showSearch = true)}
    placeholder="Search features"
  />

  {#if showSearch}
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
                on:mousemove={() => setVal({ hover: { feature: v.feature, name: v.raw } })}
                on:click={() => {
                  showSearch = false;
                  setVal({ selected: { feature: v.feature, name: v.raw } });
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
