<script lang="ts">
  import { clickOutside, oneLRU } from '$src/lib/utils';
  import { cubicInOut, cubicOut } from 'svelte/easing';
  import { fade, slide } from 'svelte/transition';
  import { Fzf } from '../../../node_modules/fzf';
  import { genHoverName, type FeatureName, type HoverName } from '../store';

  type Name = FeatureName<string>;
  let fzf: Fzf<readonly Name[]>;
  export let names: Name[];
  export let curr: HoverName<Name>;
  curr = genHoverName<Name>({});

  let showSearch = true;

  let search = '';
  let candidates: { raw: Name; embellished: string }[] = [];

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
    fzf = new Fzf(names, { limit: 8, selector: (item) => item.name });
  }

  $: if (fzf) {
    const res = fzf.find(search);
    candidates = res.map((x) => ({
      raw: x.item,
      embellished: highlightChars(x.item.name, x.positions)
    }));
  }
</script>

<div class="relative">
  <input
    type="text"
    class="w-full rounded-md border border-slate-400 bg-slate-100 py-2 px-4 shadow transition-colors dark:border-slate-600 dark:bg-slate-800"
    bind:value={search}
    on:click={() => (showSearch = true)}
    placeholder="Search features"
  />

  {#if search && showSearch}
    <div
      out:fade={{ duration: 100, easing: cubicOut }}
      class="picker absolute top-14 z-40 p-2"
      use:clickOutside
      on:outclick={() => (showSearch = false)}
      on:mouseout={() => setVal({ hover: null })}
      on:blur={() => setVal({ hover: null })}
    >
      {#each candidates as { raw, embellished }}
        <div
          class="picker-el py-1.5"
          on:mousemove={() => setVal({ hover: raw })}
          on:click={() => {
            showSearch = false;
            setVal({ selected: raw });
          }}
          transition:slide={{ duration: 100, easing: cubicInOut }}
        >
          {@html embellished}
        </div>
      {/each}
      {#if candidates.length === 0}
        <i class="py-1 px-3 text-slate-300">No genes found.</i>
      {/if}
    </div>
  {/if}
</div>

<style lang="postcss">
  .dark input::placeholder {
    @apply text-slate-200;
  }
</style>
