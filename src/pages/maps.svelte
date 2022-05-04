<script lang="ts">
  import SampleList from '$src/lib/components/sampleList.svelte';
  import { byod } from '$src/lib/data/byod';
  import { activeSample, samples, updateSample, type CurrSample } from '$src/lib/store';
  import Mapp from './mapp.svelte';

  let actives: string[] = [];
  let currSamples: CurrSample[] = [];
  let activeMap = 0;

  $: $activeSample = actives[activeMap];

  $: console.log($samples);
</script>

{#each [0, 1] as item, i}
  <section class="relative box-content h-full w-full" on:click={() => (activeMap = i)}>
    <div
      class="absolute top-4 left-4 z-20 flex max-w-[48rem] items-center justify-between gap-6 text-sm md:text-base"
    >
      <!-- Sample list -->
      <div class="flex items-center gap-x-2 pr-4 lg:pr-0">
        {#if i === 0}
          <div class="font-semibold text-slate-900 dark:font-medium dark:text-slate-100">
            Sample:
          </div>
        {/if}
        <div class:mt-1={i !== 0}>
          <SampleList
            items={Object.keys($samples)}
            on:change={(ev) => updateSample($samples[ev.detail]).then((s) => (currSamples[i] = s))}
            bind:active={actives[i]}
          />
        </div>
      </div>

      {#if i === 0}
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
      {/if}
    </div>

    <div
      class="h-full w-full border-2"
      class:border-transparent={activeMap !== i}
      class:border-slate-100={activeMap === i}
    >
      <Mapp sample={currSamples[i]?.sample} trackHover={activeMap === i} />
    </div>
  </section>
{/each}
