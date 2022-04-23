<script lang="ts" context="module">
  import { activeSample, currRna, samples } from '$src/lib/store';
  import { clickOutside, genUpdate } from '$src/lib/utils';
  import { debounce } from 'lodash-es';
  import { cubicInOut, cubicOut } from 'svelte/easing';
  import { get } from 'svelte/store';
  import { fade, slide } from 'svelte/transition';
  import { Fzf } from '../../../node_modules/fzf';
  import type { Sample } from '../data/sample';

  let fzf: Fzf<readonly string[]>;

  let names: { [key: string]: number };
  let keys: string[] = [];
  let retrieve: (selected: string) => Promise<number[]>;

  let currShow = '';
  let currSample = '';

  function highlightChars(str: string, indices: Set<number>): string {
    const chars = str.split('');
    return chars.map((c, i) => (indices.has(i) ? `<b>${c}</b>` : c)).join('');
  }

  export const showVal = debounce(async (selected: string) => {
    if (!selected || !retrieve) return;
    if (get(currRna).name !== selected || get(activeSample) !== currSample) {
      currRna.set({ name: selected, values: await retrieve(selected) });
    }
  }, 10);

  export const setVal = showVal;
</script>

<script lang="ts">
  let showSearch = true;

  const update = genUpdate(samples, (sample: Sample) => {
    setVal($currRna.name.length === 0 ? 'GFAP' : $currRna.name)?.catch(console.error);
    names = sample.features.genes.names;
    keys = Object.keys(names);
    retrieve = sample.features.genes.retrieve;
    fzf = new Fzf(keys, { limit: 8 });
  });

  update($activeSample).catch(console.error);
  setVal('GFAP')?.catch(console.error);

  $: update($activeSample).catch(console.error);

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
    id="search"
    class="w-full rounded-md border border-slate-400 bg-slate-100 py-2 px-4 shadow transition-colors dark:border-slate-600 dark:bg-slate-800"
    bind:value={search}
    on:click={() => (showSearch = true)}
    placeholder="Search features"
  />

  {#if search && showSearch}
    <div
      out:fade={{ duration: 100, easing: cubicOut }}
      class="bg-default absolute top-14 flex w-full flex-col rounded p-2  backdrop-blur"
      use:clickOutside
      on:outclick={() => (showSearch = false)}
      on:mouseout={() => setVal(currShow)}
      on:blur={() => setVal(currShow)}
    >
      {#each chosen as { raw, embellished }}
        <div
          class="hover-default cursor-pointer rounded py-1.5 px-3 "
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
  .dark input::placeholder {
    @apply text-slate-200;
  }
</style>
