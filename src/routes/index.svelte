<script lang="ts">
  import { resizable } from '$lib/utils';
  import SampleList from '$src/lib/components/sampleList.svelte';
  import SearchBox from '$src/lib/components/searchBox.svelte';
  import Nav from '$src/lib/nav.svelte';
  import { activeSample, samples } from '$src/lib/store';
  import Mapp from '$src/pages/mapp.svelte';
  import Rna from '$src/pages/rna.svelte';
</script>

<svelte:head><title>Loopy Browser</title></svelte:head>

<!-- Search -->

<main
  class="flex flex-col overflow-x-hidden bg-slate-50 dark:divide-slate-800 dark:bg-slate-900 lg:h-screen lg:flex-row"
>
  <div
    class="absolute top-4 left-4 z-20 flex max-w-[48rem] items-center justify-between gap-6 text-sm md:text-base"
  >
    <div class="mt-1 text-base lg:text-lg xl:text-xl">
      <SearchBox />
    </div>
    <div class="flex items-center gap-x-2 pr-4 lg:pr-0">
      <div class="font-semibold text-slate-900 dark:font-medium dark:text-slate-100">Sample:</div>
      <SampleList items={Object.keys($samples)} on:change={(e) => ($activeSample = e.detail)} />
    </div>
  </div>
  <div class="h-[600px] w-full lg:h-full lg:w-[75%]"><Mapp /></div>

  <div class="resizer h-full w-1 cursor-ew-resize bg-gray-200 dark:bg-gray-800" use:resizable />
  <aside class="flex h-full flex-1 flex-col pt-2">
    <Nav />
    <section class="h-full overflow-y-auto">
      <Rna />
    </section>
  </aside>
</main>
