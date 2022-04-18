<script lang="ts">
  // import Veg from '$src/lib/components/veg.svelte';
  import { activeSample, currRna, samples } from '$src/lib/store';
  import { tooltip } from '$src/lib/utils';
  import { Tab, TabGroup, TabList } from '@rgossiaux/svelte-headlessui';
  import 'tippy.js/dist/tippy.css';
  import Bar from './bar.svelte';
  import Scatter from './scatter.svelte';
  let showing = 0;

  let vegaShown = false;
  $: console.log(showing);
  $: if (showing === 1) vegaShown = true;
</script>

<div class="mx-auto mt-6 hidden w-[90%] lg:block">
  <Scatter />
</div>

<TabGroup on:change={(e) => (showing = e.detail)}>
  <TabList class="mx-4 flex space-x-1 rounded-xl  p-1 dark:bg-gray-800/50">
    <Tab class={({ selected }) => `tab ${selected ? 'tab-selected' : ''}`}>UMAP</Tab>
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
  <div class:hidden={showing !== 0}>
    <!-- {#if $samples[$activeSample] && 'umap' in $samples[$activeSample].features} -->
    <Scatter target="umap" pointRadius={2} />
    <!-- {/if} -->
  </div>
  <div class:hidden={showing !== 1}><Bar /></div>
  <!-- {#if vegaShown}
    <div class:hidden={showing !== 2}><Veg /></div>
  {/if} -->
</div>

<style lang="postcss">
  :global(div > .tippy-box) {
    @apply rounded-lg bg-gray-700/80 py-0.5 px-1 text-center backdrop-blur;
  }

  :global(div > .tippy-box > .tippy-arrow) {
    @apply text-gray-700/80;
  }

  :global(.tab) {
    @apply w-full rounded-lg py-2.5 px-2 text-sm font-medium leading-5 text-gray-500 ring-opacity-60 ring-offset-2 hover:bg-indigo-100 focus:outline-none dark:bg-gray-800 dark:text-gray-100 dark:ring-white dark:ring-offset-gray-500 dark:hover:bg-gray-700 dark:active:bg-gray-600;
  }

  :global(.tab-selected) {
    @apply tab bg-indigo-300/50 font-semibold text-indigo-800 hover:bg-indigo-300/50 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-600 dark:active:bg-gray-500;
  }
</style>
