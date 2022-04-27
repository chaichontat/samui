<script lang="ts">
  import { resizable } from '$lib/utils';
  import SampleList from '$src/lib/components/sampleList.svelte';
  import { byod } from '$src/lib/data/byod';
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
    <!-- Sample list -->
    <div class="flex items-center gap-x-2 pr-4 lg:pr-0">
      <div class="font-semibold text-slate-900 dark:font-medium dark:text-slate-100">Sample:</div>
      <SampleList items={Object.keys($samples)} />
    </div>
    <!-- Upload your data -->
    <button
      class="group relative mb-2 mr-2 inline-flex translate-y-1 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 p-0.5 text-sm font-medium text-gray-900 hover:text-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-200 group-hover:from-cyan-500 group-hover:to-blue-500 dark:text-slate-100 dark:focus:ring-cyan-800"
      on:click={byod}
    >
      <span
        class="relative rounded-md bg-slate-50/90 px-5 py-2 backdrop-blur transition-all duration-75 ease-in group-hover:bg-opacity-0 dark:bg-gray-900/80"
      >
        Run your Data
      </span>
    </button>
  </div>
  <div class="h-[600px] w-full lg:h-full lg:w-[75%]">
    <Mapp />
  </div>

  <div class="resizer h-full w-1 cursor-ew-resize bg-gray-200 dark:bg-gray-800" use:resizable />
  <aside class="relative flex h-full flex-1 flex-col pt-2">
    <section class="z-10">
      <Nav />
    </section>
    <section class="h-full overflow-y-auto">
      <Rna />
    </section>
  </aside>
</main>
