<script lang="ts">
  import {
    allFeatures,
    annoFeat,
    annoHover,
    setHoverSelect,
    sSample,
    type SimpleHS
  } from '$lib/store';
  import type { FeatureAndGroup } from '$src/lib/data/objects/feature';
  import HoverableFeature from '$src/lib/sidebar/hoverableFeature.svelte';
  import { Pencil } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as d3 from 'd3';
  import { writable } from 'svelte/store';
  import { HoverSelect } from '../searchBox';
  import SearchList from '../searchbox/SearchList.svelte';
  import RidgelineChart from './ridgeline';

  export let width = 160;
  export let height = 60;
  export let genAxis = false;
  export let fg: FeatureAndGroup | undefined = undefined;
  let h: RidgelineChart | undefined;

  export let amount: Record<string, number[]> | undefined;
  let svg: SVGSVGElement | undefined;
  let oldfg: FeatureAndGroup | undefined = undefined;

  async function updateData(fg?: FeatureAndGroup, amount?: Record<string, number[]>) {
    if (!fg) return;
    // Each section/gene.
    const ret = await $sSample.getFeature(fg);
    if (!ret) {
      console.error('Failed to get feature', fg);
      return;
    }
    const { data } = ret;
    let toSend = [data as number[]];

    $annoFeat.keys.forEach((key) => {
      const idxs = amount![key];
      if (!idxs) return;
      toSend.push(idxs.map((l) => data[l] as number));
    });

    if (!h) h = new RidgelineChart(svg, width, height, 5, 10, [0, 10]);

    h.genXAxis(!genAxis);
    h.genArea(
      fg?.feature,
      toSend,
      ['url(#grad)'].concat(d3.schemeTableau10.slice(0, $annoFeat.keys.length)),
      fg !== oldfg
    );
    oldfg = fg;
  }

  $: h?.highlight($annoHover == undefined ? undefined : $annoHover + 1);
  let showSearch = false;
  let search = '';
  let store = writable(fg as FeatureAndGroup | undefined);
  let hs = new HoverSelect<FeatureAndGroup>();
  const set = (h: SimpleHS<FeatureAndGroup>) => {
    if (h.selected) {
      showEdit = false;
      showSearch = false;
    }
    hs.update(h);
    if (hs.active) store.set(hs.active);
  };

  let showEdit = false;
  let box: HTMLInputElement;

  $: updateData($store, amount).catch(console.error);
  $: console.log($store);
</script>

<td class="relative p-0 text-right text-sm overflow-visible">
  {#if showEdit}
    <div>
      <input
        type="text"
        class="bg-neutral-700 text-neutral-100 w-20 h-8 p-2 rounded-lg text-right focus:ring-neutral-300"
        bind:this={box}
        bind:value={search}
        on:click={() => (showSearch = true)}
      />
    </div>
  {:else}
    <button
      class="flex items-center gap-x-1 w-20 h-8 justify-end group"
      on:click={() => {
        showEdit = true;
        showSearch = true;
        setTimeout(() => box.select(), 25);
      }}
    >
      <Icon
        src={Pencil}
        class="svg-icon stroke-2 stroke-indigo-300/90 h-3 w-3 group-hover:stroke-violet-400"
      />
      <HoverableFeature
        class="group:hover:text-sky-200"
        textClass="grad"
        selectEnabled={false}
        set={setHoverSelect}
        feature={$store}
      />
    </button>
  {/if}

  <SearchList
    class="absolute left-6 top-16 text-sm z-40 bg-neutral-700/70 pb-2 m-2 w-48 rounded-lg backdrop-blur-lg"
    bind:showSearch
    on:outclick={() => (showEdit = false)}
    {search}
    featureGroup={$allFeatures}
    {set}
    limit={1}
  />
</td>
<td class="p-0">
  <div class="">
    <svg
      bind:this={svg}
      height={genAxis ? height + 15 : height}
      width={genAxis ? width + 5 : width}
    />
  </div>
</td>

<style lang="postcss">
  :global(svg .tick) {
    @apply text-neutral-300;
  }

  :global(.grad) {
    @apply font-medium;
    background: linear-gradient(135deg, #989fff, #ffe0e0 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
  }
</style>
