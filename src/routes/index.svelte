<script lang="ts">
  import { resizable } from '$lib/utils';
  import SampleList from '$src/lib/components/sampleList.svelte';
  import { byod } from '$src/lib/data/byod';
  import type { Sample } from '$src/lib/data/sample';
  import Nav from '$src/lib/nav.svelte';
  import { activeSample, samples } from '$src/lib/store';
  import Mapp from '$src/pages/mapp.svelte';
  import Rna from '$src/pages/rna.svelte';

  let sample: Sample;
  $: sample = $samples[$activeSample];
  $: console.log($samples);
</script>

<svelte:head><title>Loopy Browser</title></svelte:head>

<!-- Search -->

<main
  class="flex flex-col overflow-x-hidden bg-slate-50 dark:divide-slate-800 dark:bg-slate-900 lg:h-screen lg:flex-row"
>
  <section
    class="absolute top-4 left-4 z-20 flex max-w-[48rem] items-center justify-between gap-6 text-sm md:text-base"
  >
    {#if sample}
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
          class="relative rounded-md bg-slate-50 bg-opacity-80 px-5 py-2 backdrop-blur transition-all duration-75 ease-in group-hover:bg-opacity-0 dark:bg-gray-900 dark:bg-opacity-80"
        >
          Add Sample
        </span>
      </button>
    {:else}
      <div class="text-xl lg:text-2xl text-yellow-600 dark:text-yellow-300/80">Loopy Browser</div>
    {/if}
  </section>

  <div class="relative h-[600px] w-full lg:h-full lg:w-[75%]">
    {#if sample}
      <Mapp />
    {:else}
      <!-- Splash import -->
      <div
        class="flex items-center gap-x-2 lg:gap-x-3 cursor-pointer absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-800 dark:text-slate-400 text-2xl sm:text-3xl lg:text-4xl transition-colors dark:hover:text-slate-200"
        on:click={byod}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4 lg:h-6 lg:w-6 translate-y-0.5 stroke-[4]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Import Sample
      </div>
    {/if}
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
