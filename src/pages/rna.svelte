<script lang="ts">
  import SearchBox from '$src/lib/components/searchBox.svelte';
  import Veg from '$src/lib/components/veg.svelte';
  import { currRna } from '$src/lib/store';
  import { tooltip } from '$src/lib/utils';
  import { Tab, TabGroup, TabList } from '@rgossiaux/svelte-headlessui';
  import 'tippy.js/dist/tippy.css';
  import Bar from './bar.svelte';
  import Scatter from './scatter.svelte';
  let showing = 0;

  $: console.log(showing);
</script>

<section class="flex flex-grow flex-col gap-y-2">
  <div class="flex w-[50vw] max-w-[500px] flex-col">
    <SearchBox />
    <div class="mr-2 translate-y-2 self-end text-lg font-medium">
      Showing <i>{$currRna.name}</i>.
    </div>
    <Scatter />

    <TabGroup on:change={(e) => (showing = e.detail)}>
      <TabList class="flex space-x-1 rounded-xl bg-gray-800/50 p-1">
        <Tab class={({ selected }) => `tab ${selected ? 'tab-selected' : ''}`}>
          <div
            use:tooltip={'Correlation between the read counts of 4,000 highly expressed genes and sum of signal intensity within a spot.'}
            class="h-full w-full"
          >
            Gene/Intensity Correlation
          </div>
        </Tab>
        <Tab class={({ selected }) => `tab ${selected ? 'tab-selected' : ''}`}>Spot Values</Tab>
        <!-- <Tab class={({ selected }) => `tab ${selected ? 'tab-selected' : ''}`}>Tab 3</Tab> -->
      </TabList>
      <!-- <TabPanels class="mt-4">
        <TabPanel><Bar /></TabPanel>
        <TabPanel><Veg /></TabPanel>
      </TabPanels> -->
    </TabGroup>

    <div class="mt-2">
      <div class:hidden={showing !== 0}><Veg /></div>
      <div class:hidden={showing !== 1}><Bar /></div>
    </div>
  </div>
</section>

<style lang="postcss">
  :global(div > .tippy-box) {
    @apply rounded-lg bg-gray-800/80 py-0.5 px-1 text-center backdrop-blur;
  }

  :global(div > .tippy-box > .tippy-arrow) {
    @apply text-gray-800/80;
  }

  :global(.tab) {
    @apply w-full rounded-lg bg-gray-800 py-2.5 text-sm font-medium leading-5 shadow ring-white ring-opacity-60 ring-offset-2 ring-offset-gray-500 hover:bg-gray-700 focus:outline-none active:bg-gray-600;
  }

  :global(.tab-selected) {
    @apply tab bg-gray-600 hover:bg-gray-600 active:bg-gray-500;
  }
</style>
