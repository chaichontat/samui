<script lang="ts">
  import SearchBox from '$src/lib/components/searchBox.svelte';
  // import Veg from '$src/lib/components/veg.svelte';
  import { activeFeatures, currSample, store } from '$src/lib/store';
  import { tooltip } from '$src/lib/utils';
  import { Tab, TabGroup, TabList } from '@rgossiaux/svelte-headlessui';
  import type { ChartConfiguration } from 'chart.js';
  import type { SvelteComponent } from 'svelte';
  import 'tippy.js/dist/tippy.css';
  import Bar from './bar.svelte';
  import Scatter from './scatter.svelte';
  import Scatterxy from './scatterxy.svelte';
  let showing = 0;

  let sections: typeof Scatterxy[] = [];

  let vegaShown = false;
  $: if (showing === 1) vegaShown = true;

  let values: number[] = [];
  let dataType = 'quantitative';

  const naviChartOptions: ChartConfiguration<'scatter'> = {
    scales: {
      x: {
        display: false
      },
      y: {
        display: false,
        reverse: true
      }
    }
  };
</script>

<div class="flex flex-col items-center gap-y-4 divide-y dark:divide-slate-700">
  <section class:mt-6={$currSample}>
    {#if $currSample}
      {#await $currSample.sample.promise then _}
        <Scatter
          coordsSource={{ name: $currSample.sample.name, values: $currSample.sample.image.coords }}
          intensitySource={{
            name: `${$currSample.sample.name}-${$activeFeatures.name}`,
            dataType: dataType,
            values: $currSample.sample.getFeature($activeFeatures).values
          }}
          mainChartOptions={naviChartOptions}
          hoverChartOptions={naviChartOptions}
          bind:currHover={$store.currIdx.idx}
          colorbar
        />
      {/await}
    {:else}
      <div class="h-20" />
      <span class="center text-xl text-default">No sample</span>
    {/if}
  </section>

  <!-- <section class="pt-4"> -->
  <!-- <TabGroup on:change={(e) => (showing = e.detail)}>
      <TabList class="mx-4 flex space-x-1 rounded-xl  bg-indigo-50 p-1 dark:bg-slate-800/50">
        <Tab class={({ selected }) => `tab ${selected ? 'tab-selected' : ''}`}>+ Scatter</Tab>
        <Tab class={({ selected }) => `tab ${selected ? 'tab-selected' : ''}`}>+ bar</Tab>
        <!-- <Tab class={({ selected }) => `tab ${selected ? 'tab-selected' : ''}`}>
        <div
        use:tooltip={'Correlation between the read counts of 4,000 highly expressed genes and sum of signal intensity within a spot.'}
        class="h-full w-full"
        >
        Intensity Correlation
      </div>
    </Tab> -->
  <!-- </TabList>
    </TabGroup> -->
  <!-- </section> -->

  {#each sections as section}
    <section>
      <svelte:component this={section} featureNames={$currSample?.featureNames} />
    </section>
  {/each}

  <section class="flex w-full justify-around">
    <button
      class="button flex-grow py-3 transition-colors duration-75 dark:bg-slate-800 hover:dark:bg-slate-500"
      on:click={() => {
        sections.push(Scatterxy);
        sections = sections;
      }}>Add Scatter</button
    >
  </section>
</div>

<style lang="postcss">
  section {
    @apply relative hidden w-[90%] px-4 pt-4 lg:block;
  }

  :global(div > .tippy-box) {
    @apply rounded-lg bg-slate-700/80 py-0.5 px-1 text-center backdrop-blur;
  }

  :global(div > .tippy-box > .tippy-arrow) {
    @apply text-slate-700/80;
  }

  :global(.tab) {
    @apply w-full rounded-lg py-2.5 px-2 text-sm font-medium leading-5 text-slate-500 ring-opacity-60 ring-offset-2 hover:bg-indigo-100 focus:outline-none;
  }

  :global(.dark .tab) {
    @apply bg-slate-800 text-slate-100 ring-white ring-offset-slate-500 hover:bg-slate-700;
  }

  :global(.tab-selected) {
    @apply bg-indigo-300/50 font-semibold text-indigo-800 hover:bg-indigo-300/50;
  }

  :global(.dark .tab-selected) {
    @apply bg-slate-600 text-white hover:bg-slate-600 active:bg-slate-500;
  }
</style>
