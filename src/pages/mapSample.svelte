<script lang="ts">
  import { tooltip } from '$lib/utils';
  import SampleList from '$src/lib/components/sampleList.svelte';
  import { byod } from '$src/lib/data/byod';
  import { activeMap, activeSample, samples, updateSample, type CurrSample } from '$src/lib/store';
  import { deleteTile, isLeaf, splitTile, type Hie } from '$src/lib/tiling';
  import { createEventDispatcher } from 'svelte';
  import Mapp from './mapp.svelte';

  let active: string;
  let currSample: CurrSample;

  const dispatch = createEventDispatcher();
  let i: number | undefined;
  export let hie: Hie;
  $: {
    console.log(hie);
    i = hie.thisMap;
  }
  $: if (i !== undefined && $samples[active]) {
    updateSample($samples[active])
      .then((s) => {
        currSample = s;
        setActive(i);
      })
      .catch(console.error);
  }

  function setActive(i: number) {
    $activeMap = i;
    $activeSample = currSample.sample.name;
  }
</script>

{#if isLeaf(hie) && i !== undefined}
  <section class="relative box-content h-full w-full" on:click={() => setActive(i)}>
    <div
      class="absolute top-4 left-4 z-20 flex max-w-[48rem] items-center justify-between gap-4 text-sm md:text-base"
      on:click={() => setActive(i)}
    >
      {#if i > 0}
        <button use:tooltip={{ content: 'Close View' }} on:click={() => dispatch('delete', i)}>
          <svg xmlns="http://www.w3.org/2000/svg" class="svg-icon h-5 w-5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      {/if}

      <!-- Sample list -->
      <div class="flex items-center gap-x-2 pr-4 lg:pr-0">
        {#if i === 0}
          <div class="font-semibold text-slate-900 dark:font-medium dark:text-slate-100">
            Sample:
          </div>
        {/if}

        <div class:mt-1={i !== 0}>
          <SampleList items={Object.keys($samples)} bind:active />
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

      <button
        use:tooltip={{ content: 'Split vertical' }}
        on:click={() => (hie = splitTile(hie, 'v'))}
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="svg-icon h-5 w-5" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
          />
        </svg>
      </button>

      <button
        use:tooltip={{ content: 'Split horizontal' }}
        on:click={() => (hie = splitTile(hie, 'h'))}
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="svg-icon h-5 w-5" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
      </button>
    </div>

    <div
      class="h-full w-full border-2"
      class:border-slate-800={$activeMap !== i}
      class:border-slate-100={$activeMap === i}
    >
      <Mapp sample={currSample?.sample} trackHover={$activeMap === i} />
    </div>
  </section>
{:else}
  <div
    class="grid h-full w-full"
    class:grid-rows-2={hie.split === 'v'}
    class:grid-cols-2={hie.split === 'h'}
  >
    <svelte:self bind:hie={hie.maps[0]} on:delete={() => (hie = deleteTile(hie, 0))} />
    <svelte:self bind:hie={hie.maps[1]} on:delete={() => (hie = deleteTile(hie, 1))} />
  </div>
{/if}
