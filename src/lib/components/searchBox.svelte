<script lang="ts" context="module">
  import { browser } from '$app/env';
  import { genRetrieve } from '$src/lib/fetcher';
  import { currRna } from '$src/lib/store';
  import { clickOutside, debounce } from '$src/lib/utils';
  import { Fzf } from 'fzf';
  import { get } from 'svelte/store';
  import { fade } from 'svelte/transition';
  import { dataPromise } from '../../routes/index.svelte';

  let names: { [key: string]: number };
  let keys: string[] = [];
  let fzf: Fzf<readonly string[]>;
  let ptr: number[];
  let coords: { x: number; y: number }[];
  let retrieve: (selected: string) => Promise<number[]>;

  let currShow = '';
  const getHeader = async () => {
    [names, ptr] = await Promise.all([
      fetch('/Br6522_Ant_IF/names.json').then(
        (x) => x.json() as Promise<{ [key: string]: number }>
      ),
      fetch('/Br6522_Ant_IF/ptr.json').then((res) => res.json() as Promise<number[]>)
    ]);

    keys = Object.keys(names);
    fzf = new Fzf(keys, { limit: 8 });
  };

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
  async function hydrate() {
    const dp = (async () => {
      ({ coords } = await dataPromise);
    })().catch(console.error);
    const he = getHeader().catch(console.error);
    await Promise.all([dp, he]);
    retrieve = genRetrieve(ptr, names, coords.length);
    currShow = 'GFAP';
    setVal('GFAP');
  }

  if (browser) {
    hydrate().catch(console.error);
  }

  let search = '';
  let chosen: { raw: string; embellished: string }[] = [{ raw: '', embellished: '' }];

  $: if (fzf) {
    showSearch = true;
    const res = fzf.find(search);
    chosen = res.map((x) => ({ raw: x.item, embellished: highlightChars(x.item, x.positions) }));
  }
</script>

<input
  type="text"
  class="mb-2 w-full rounded border border-gray-600 bg-gray-800 py-2 px-4 "
  bind:value={search}
  on:click={() => (showSearch = true)}
  placeholder="Search genes..."
/>

{#if search && showSearch}
  <div
    out:fade={{ duration: 100 }}
    class="fixed z-20 flex min-w-[200px] translate-y-12 flex-col rounded bg-gray-800/80 px-2 pt-1 pb-2  text-slate-100 backdrop-blur"
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
      >
        {@html embellished}
      </div>
    {/each}
    {#if chosen.length === 0}
      <i class="py-1 px-3 text-slate-300">No genes found.</i>
    {/if}
  </div>
{/if}
