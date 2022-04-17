<script lang="ts" context="module">
  import promise from '$lib/meh';
  import { activeSample, currRna, samples } from '$src/lib/store';
  import { clickOutside, debounce } from '$src/lib/utils';
  import { Fzf } from 'fzf';
  import { onMount } from 'svelte';
  import { cubicInOut, cubicOut } from 'svelte/easing';
  import { get } from 'svelte/store';
  import { fade, slide } from 'svelte/transition';
  import type { Sample } from '../data/sample';

  let fzf: Fzf<readonly string[]>;

  let names: { [key: string]: number };
  let keys: string[] = [];
  let retrieve: (selected: string) => Promise<number[]>;

  let currShow = '';

  function highlightChars(str: string, indices: Set<number>): string {
    const chars = str.split('');
    return chars.map((c, i) => (indices.has(i) ? `<b>${c}</b>` : c)).join('');
  }

  export const showVal = debounce(async (selected: string) => {
    if (!selected || !retrieve) return;
    if (get(currRna).name !== selected) {
      currRna.set({ name: selected, values: await retrieve(selected) });
    }
  }, 10);

  export const setVal = debounce((selected: string) => {
    showVal(selected);
  }, 10);
</script>

<script lang="ts">
  let showSearch = true;

  function update(sample: Sample) {
    names = sample.features.genes.names;
    keys = Object.keys(names);
    retrieve = sample.features.genes.retrieve;
    fzf = new Fzf(keys, { limit: 8 });

    // const he = getHeader().catch(console.error);
    // await Promise.all([dp, he]);
    currShow = 'GFAP';
    setVal('GFAP');
  }

  onMount(async () => {
    update(await promise[0]);
  });

  let currSample = '';
  $: if ($activeSample !== currSample) update($samples[$activeSample]);

  let search = '';
  let chosen: { raw: string; embellished: string }[] = [{ raw: '', embellished: '' }];

  $: if (fzf) {
    showSearch = true;
    const res = fzf.find(search);
    chosen = res.map((x) => ({ raw: x.item, embellished: highlightChars(x.item, x.positions) }));
  }
</script>

<div class="relative">
  <input
    type="text"
    class="w-full rounded border border-gray-600 bg-gray-800 py-2 px-3 "
    bind:value={search}
    on:click={() => (showSearch = true)}
    placeholder="Search features"
  />

  {#if search && showSearch}
    <div
      out:fade={{ duration: 100, easing: cubicOut }}
      class="absolute top-14 z-30 flex w-full flex-col rounded bg-gray-800/80 px-2 pt-1 pb-2 text-slate-100 backdrop-blur"
      use:clickOutside
      on:outclick={() => (showSearch = false)}
      on:mouseout={() => setVal(currShow)}
      on:blur={() => setVal(currShow)}
    >
      {#each chosen as { raw, embellished }}
        <div
          class="cursor-pointer rounded py-1.5 px-3 hover:bg-gray-700/80 active:bg-gray-600/80"
          on:mousemove={() => setVal(raw)}
          on:click={() => {
            showSearch = false;
            currShow = raw;
          }}
          transition:slide={{ duration: 100, easing: cubicInOut }}
        >
          {@html embellished}
        </div>
      {/each}
      {#if chosen.length === 0}
        <i class="py-1 px-3 text-slate-300">No genes found.</i>
      {/if}
    </div>
  {/if}
</div>

<style lang="postcss">
  ::placeholder {
    @apply text-slate-200;
  }
</style>
