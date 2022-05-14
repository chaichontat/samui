<script lang="ts">
  import Nav from '$src/lib/nav.svelte';
  import { activeFeatures, activeOverlay, sample, store } from '$src/lib/store';
  import { tooltip } from '$src/lib/utils';
  import type { ChartConfiguration } from 'chart.js';
  import 'tippy.js/dist/tippy.css';
  import Bar from './bar.svelte';
  import Scatter from './scatter.svelte';
  import Scatterxy from './scatterxy.svelte';
  let showing = 0;

  let sections: typeof Scatterxy[] = [];

  let vegaShown = false;
  $: if (showing === 1) vegaShown = true;

  let intensity;

  $: if ($sample) {
    const f = $sample.getFeature($activeFeatures[$activeOverlay]);
    intensity = f
      ? {
          name: `${$sample.name}-${$activeOverlay}-${$activeFeatures[$activeOverlay]?.name}`,
          dataType: f.dataType,
          values: f.values
        }
      : undefined;
  }

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

<aside class="relative flex h-full w-full flex-1 flex-col overflow-y-auto">
  <div class="z-40 w-full">
    <Nav />
  </div>

  <div class="flex flex-col items-center gap-y-4 divide-y dark:divide-slate-700">
    <section class:mt-6={sample}>
      {#if $sample}
        {#await $sample.promise then _}
          <Scatter
            coordsSource={{
              name: `${$sample.name}-${$activeOverlay}`,
              values: $sample.overlays[$activeOverlay]?.pos
            }}
            intensitySource={intensity}
            mainChartOptions={naviChartOptions}
            hoverChartOptions={naviChartOptions}
            bind:currHover={$store.currIdx.idx}
            colorbar
          />
        {/await}
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

    <!--
    {#each sections as section}
      <section>
        <svelte:component this={section} FeatureNamesGroup={.FeatureNamesGroup} />
      </section>
    {/each} -->

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
</aside>

<style lang="postcss">
  section {
    @apply relative hidden w-[90%] pt-4 lg:block;
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
