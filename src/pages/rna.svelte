<script lang="ts">
  import SearchBox from '$src/lib/components/searchBox.svelte';
  // import Veg from '$src/lib/components/veg.svelte';
  import { activeFeatures, activeSample, samples, store } from '$src/lib/store';
  import { tooltip } from '$src/lib/utils';
  import { Tab, TabGroup, TabList } from '@rgossiaux/svelte-headlessui';
  import type { ChartConfiguration } from 'chart.js';
  import 'tippy.js/dist/tippy.css';
  import Bar from './bar.svelte';
  import Scatter from './scatter.svelte';
  let showing = 0;

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

  $: if (sample?.hydrated) {
    const f = sample.getFeature($activeFeatures);
    values = f.values as number[];
    dataType = f.dataType;
  }
</script>

<div class="flex flex-col divide-y dark:divide-slate-700">
  <div class="relative mx-auto hidden w-[90%] lg:block" class:mt-6={sample}>
    {#if sample}
      <!-- content here -->
      {#await $samples[$activeSample].promise then _}
        <!-- promise was fulfilled -->
        <Scatter
          coordsSource={{ name: $activeSample, values: sample.image.coords }}
          intensitySource={{
            name: $activeFeatures.name,
            dataType: dataType,
            values: values
          }}
          bind:currHover={$store.currIdx.idx}
          colorbar
        />
      {/await}
    {:else}
      <div class="h-20" />
      <span class="center text-xl text-default">No sample</span>
    {/if}
  </div>

  <section class="pt-4">
    <TabGroup on:change={(e) => (showing = e.detail)}>
      <TabList class="mx-4 flex space-x-1 rounded-xl  bg-indigo-50 p-1 dark:bg-slate-800/50">
        <Tab class={({ selected }) => `tab ${selected ? 'tab-selected' : ''}`}>Scatter</Tab>
        <Tab class={({ selected }) => `tab ${selected ? 'tab-selected' : ''}`}>Spot Values</Tab>
        <!-- <Tab class={({ selected }) => `tab ${selected ? 'tab-selected' : ''}`}>
        <div
        use:tooltip={'Correlation between the read counts of 4,000 highly expressed genes and sum of signal intensity within a spot.'}
        class="h-full w-full"
        >
        Intensity Correlation
      </div>
    </Tab> -->
      </TabList>
    </TabGroup>

    <div class="mx-auto mt-6 w-[50vh] lg:w-[90%]">
      <div class="flex flex-col gap-y-1" class:hidden={showing !== 0}>
        <!-- {#if $samples[$activeSample] && 'umap' in $samples[$activeSample].features} -->
        <div class="flex items-center gap-x-2">
          x:
          <SearchBox />
          y: <SearchBox />
        </div>

        <div class="flex items-center gap-x-2">
          Color: <div class="w-full"><SearchBox /></div>
        </div>

        <!-- <Scatter coordsSource="umap" intensitySource={$currRna.values} pointRadius={2} /> -->
      </div>
      <div class:hidden={showing !== 1}>
        <!-- <Bar showing={showing === 1} /> -->
      </div>
      <!-- {#if vegaShown}
    <div class:hidden={showing !== 2}><Veg /></div>
    {/if} -->
    </div>
  </section>
</div>

<style lang="postcss">
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
