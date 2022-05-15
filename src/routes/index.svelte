<script lang="ts">
  import { resizable } from '$lib/utils';
  import Github from '$src/lib/components/github.svelte';
  import { byod } from '$src/lib/data/byod';
  import { getSample } from '$src/lib/data/meh';
  import { mapList, preload, samples } from '$src/lib/store';
  import MapSample, { type Hie } from '$src/pages/mapTile.svelte';
  import Sidebar from '$src/pages/sidebar.svelte';
  import { onMount } from 'svelte';

  $mapList = [0];
  let hie: Hie = {
    root: true,
    maps: [0]
  };

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get('url');
    const s = params.getAll('s');

    if (s.length > 0) {
      Promise.all(
        s.map((ss) =>
          getSample('https://' + (url ?? '') + ss).then((sa) => ($samples[sa.name] = sa))
        )
      ).catch(alert);
    }
  });
</script>

<svelte:head><title>Loopy Browser</title></svelte:head>

<!-- Search -->

<main
  class="flex flex-col overflow-x-hidden bg-slate-50 dark:divide-slate-800 dark:bg-slate-900 lg:h-screen lg:flex-row"
>
  {#if Object.keys($samples).length > 0}
    <div class="relative h-[600px] w-full overflow-hidden lg:h-full lg:w-[75%]">
      <article class="h-full w-full" id="allMaps">
        <MapSample {hie} />
      </article>
    </div>

    <div class="resizer h-full w-1 cursor-ew-resize bg-gray-200 dark:bg-gray-800" use:resizable />

    <Sidebar />
  {:else}
    <!-- Splash import -->
    <nav class="flex justify-between w-full py-3 px-5">
      <div class="text-2xl font-medium text-yellow-300">Loopy Browser</div>
      <Github />
    </nav>

    <div class="center flex flex-col items-center gap-y-3">
      <button
        class="text-xl group relative mb-2 mr-2 inline-flex translate-y-1 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 p-0.5 font-medium text-gray-900 hover:text-slate-50 focus:outline-none focus:ring-2 focus:ring-pink-200 group-hover:from-purple-600 group-hover:to-pink-500 dark:text-slate-100 dark:focus:ring-pink-800"
        on:click={byod}
      >
        <span
          class="flex gap-x-1 items-center relative rounded-md bg-slate-50 bg-opacity-80 px-5 py-3 backdrop-blur transition-all duration-75 ease-in group-hover:bg-opacity-0 dark:bg-gray-900 dark:bg-opacity-80"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 stroke-[4]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Import Sample
        </span>
      </button>

      <button
        class="text-lg group relative mb-2 mr-2 inline-flex translate-y-1 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 p-0.5 font-medium text-gray-900 hover:text-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-200 group-hover:from-cyan-500 group-hover:to-blue-500 dark:text-slate-100 dark:focus:ring-cyan-800"
        on:click={() => {
          preload();
          // const r = [0, Math.random(), Math.random()];
          // hie = {
          //   root: true,
          //   split: 'h',
          //   maps: [{ split: 'v', maps: [0, { maps: [r[1]] }] }, { maps: [r[2]] }]
          // };
          // $mapList = r;
        }}
      >
        <span
          class="relative rounded-md bg-slate-50 bg-opacity-80 px-5 py-2 backdrop-blur transition-all duration-75 ease-in group-hover:bg-opacity-0 dark:bg-gray-900 dark:bg-opacity-80"
        >
          Show Visium-IF Data
        </span>
      </button>
    </div>
  {/if}
</main>
