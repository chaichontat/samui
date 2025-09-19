<script lang="ts">
  import SampleList from '$lib/components/sampleList.svelte';
  import { isOnline, mapIdSample, mapTiles, samples, sEvent, sMapId, sMapp } from '$lib/store';
  import type { Mapp as MappObj } from '$lib/ui/mapp';
  import { byod } from '$src/lib/data/byod';
  import { tooltip } from '$src/lib/ui/utils';
  import { ArrowsRightLeft, ArrowsUpDown, XMark } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { afterUpdate, createEventDispatcher } from 'svelte';
  // import Mapp from './mapp.svelte'; // Dynamic import
  import type { Hierarchy } from '$lib/mapTile';

  export let hie: Hierarchy | number;
  let hieN: number;
  $: hieN = typeof hie === 'number' ? hie : -1;

  let refreshPls = false;
  let width = 0;

  const dispatch = createEventDispatcher();

  // $: if (typeof hie === 'number') {
  //   $focus
  //     .setSample(active)
  //     .then(() => ($focus = $focus))
  //     .catch(console.error);
  // }
  const adjustSize = (map: MappObj) => setTimeout(() => map.map!.updateSize(), 15);

  function handleSplit(i: number, mode: 'h' | 'v') {
    if (!hie || typeof hie === 'number') throw new Error('No hie');
    if (hie.maps.length > 1 && !('split' in hie)) throw new Error('No split');

    if (!hie.split || hie.maps.filter(Boolean).length === 1) {
      console.debug(`Set mode to ${mode}`);
      hie.split = mode;
    }
    adjustSize($sMapp);

    const newUId = Math.random();
    if (hie.split === mode) {
      if (hie.maps.at(-1) != undefined) hie.maps.push(null);
      hie.maps[hie.maps.length - 1] = newUId;
    } else {
      hie.maps[i] = { split: mode, maps: [hie.maps[i], newUId] };
    }
    $mapTiles.push(-1);
    $mapTiles[$mapTiles.length - 1] = newUId; // For reactivity.
  }

  function handleDelete(i: number) {
    if (!hie || typeof hie === 'number') throw new Error('No hie');
    adjustSize($sMapp);
    const old = hie.maps[i];
    hie.maps[i] = null;
    if (i === hie.maps.length - 1) {
      /// Reduce memory leak.
      hie.maps.pop();
    }

    if (hie.maps.every((x) => x == undefined)) {
      dispatch('delete');
    }

    refreshPls = true;
    if (typeof old === 'number') {
      const idx = $mapTiles.findIndex((x) => x === old);
      $mapTiles.splice(idx, 1);
      $mapTiles = $mapTiles;
      if (idx > 0) {
        $sMapId = $mapTiles[idx - 1];
      } else {
        throw new Error('Should be impossible to delete the first map');
      }
    }
  }

  afterUpdate(() => {
    if (refreshPls) {
      document.body.dispatchEvent(new Event('resize'));
      setTimeout(() => document.body.dispatchEvent(new Event('resize')), 50);
      refreshPls = false;
    }
  });

  // Stop loading spinner when sample is hydrated.
  let sampleListElem: SampleList;
  $: console.log($samples);

  $: if ($sEvent?.type === 'renderComplete') {
    sampleListElem?.stopSpinner();
  }
</script>

{#if typeof hie === 'number'}
  <section
    class="relative box-content h-full w-full grow overflow-x-hidden"
    id={`view-${hieN}`}
    bind:clientWidth={width}
  >
    <div
      class="absolute top-4 left-4 z-50 flex max-w-3xl items-center justify-between gap-x-3 text-sm md:text-base"
    >
      {#if hie > 0}
        <button use:tooltip={{ content: 'Close View' }} on:click={() => dispatch('delete')}>
          <Icon src={XMark} class="svg-icon h-5 w-5" />
        </button>
      {/if}

      <!-- Sample list -->
      <div class="flex h-10 items-center gap-x-2 pr-4 md:pr-0">
        {#if hie === 0 && width > 400}
          <div class="font-semibold text-neutral-900 dark:font-medium dark:text-neutral-100">
            Sample:
          </div>
        {/if}

        <div class:mt-1={hie !== 0} class="min-w-[200px]">
          <SampleList
            bind:this={sampleListElem}
            items={$samples.map((x) => x.name)}
            on:change={(e) => {
              if (
                $sMapp?.persistentLayers.annotations.points.length > 0 &&
                !confirm(
                  'You have unsaved annotations. If you change sample, they will be lost. Are you sure you want to continue?'
                )
              ) {
                return;
              }
              $mapIdSample[hieN] = e.detail;
            }}
            active={$mapIdSample[hieN]}
            on:addSample={byod}
          />
        </div>
      </div>

      <!-- Disable split -->
      <!-- <button
        class="donotsave h-9"
        use:tooltip={{ content: 'Split vertical' }}
        on:click={() => dispatch('split', 'v')}
      >
        <Icon src={ArrowsUpDown} class="svg-icon h-5 w-5" />
      </button>

      <button
        class="donotsave h-9"
        use:tooltip={{ content: 'Split horizontal' }}
        on:click={() => dispatch('split', 'h')}
      >
        <Icon src={ArrowsRightLeft} class="svg-icon h-5 w-5" />
      </button> -->

      {#if hie === 0 && width > 800 && !$isOnline}
        <!-- Upload your data -->
        <button
          class="donotsave splash-button group mb-2 mr-2 translate-y-1 rounded-lg bg-linear-to-br from-cyan-500 to-blue-500 p-0.5 text-sm font-medium text-neutral-900 hover:text-neutral-50 focus:ring-2 focus:ring-cyan-200 group-hover:from-cyan-500 group-hover:to-blue-500 dark:text-neutral-100 dark:focus:ring-cyan-800"
          on:click={byod}
        >
          <span class="px-5 py-2 group-hover:bg-neutral-50/0 dark:group-hover:bg-neutral-900/0">Add Sample</span>
        </button>
      {/if}
    </div>

    <div
      class="h-full w-full border"
      class:border-neutral-900={$sMapId !== hieN || ($sMapId === hieN && $mapTiles.length === 1)}
      class:border-b-neutral-600={$sMapId !== hieN || ($sMapId === hieN && $mapTiles.length === 1)}
      class:border-neutral-100={$sMapId === hieN && $mapTiles.length > 1}
      on:click={() => ($sMapId = hieN)}
    >
      {#await import('./mapp.svelte') then mapp}
        <svelte:component
          this={mapp.default}
          sample={$samples.find((x) => x.name === $mapIdSample[hieN])?.sample}
          uid={hie}
        />
      {/await}
    </div>
  </section>
{:else}
  <div class="flex h-full w-full" class:flex-col={hie.split === 'v'}>
    {#each hie.maps as h, i}
      {#if h != undefined}
        <svelte:self
          hie={h}
          on:split={(ev) => handleSplit(i, ev.detail)}
          on:delete={() => handleDelete(i)}
        />
      {/if}
    {/each}
  </div>
{/if}
