<script lang="ts">
  import { resizable } from '$lib/utils';
  import Darkswitch from '$src/lib/components/darkswitch.svelte';
  import SampleList from '$src/lib/components/sampleList.svelte';
  import SearchBox from '$src/lib/components/searchBox.svelte';
  import Nav from '$src/lib/nav.svelte';
  import { activeSample, currRna, samples } from '$src/lib/store';
  import Mapp from '$src/pages/mapp.svelte';
  import Rna from '$src/pages/rna.svelte';
</script>

<svelte:head><title>Loopy Browser</title></svelte:head>

<!-- Search -->
<div
  class="absolute top-4 left-4 z-20 flex  max-w-[48rem] items-center justify-between gap-6 text-sm text-slate-100 md:text-base"
>
  <div class="text-base lg:text-lg xl:text-xl">
    <SearchBox />
  </div>
  <div class="flex items-center gap-x-2 pr-4 lg:pr-0">
    <div class="font-semibold text-gray-900 dark:font-medium dark:text-white">Sample:</div>
    <SampleList items={Object.keys($samples)} on:change={(e) => ($activeSample = e.detail)} />
  </div>
</div>

<main
  class="flex flex-col overflow-x-hidden dark:divide-gray-900 lg:h-screen lg:flex-row lg:flex-nowrap"
>
  <div class="h-[600px] w-[75%] shadow lg:h-full">
    <Mapp />
  </div>

  <div class="resizer h-full w-1 cursor-ew-resize bg-gray-200 dark:bg-gray-800" use:resizable />
  <div class="flex h-full flex-1 flex-col pt-2">
    <Nav />
    <section class="h-full overflow-y-auto">
      <Rna />
    </section>
  </div>
</main>
