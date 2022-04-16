<script lang="ts" context="module">
  import { browser } from '$app/env';
  import getData from '../lib/fetcher';
  import Mapp from '../pages/mapp.svelte';
  import Rna from '../pages/rna.svelte';

  export const sample = 'Br6522_Ant_IF';
  export const proteinMap = {
    DAPI: 2,
    TMEM119: 6,
    Olig2: 5,
    GFAP: 3,
    NeuN: 4,
    Lipofuschin: 1,
    None: 7
  };

  export const dataPromise = browser ? getData(sample) : undefined;
</script>

<svelte:head><title>Loopy Browser</title></svelte:head>

<div class="flex justify-between">
  <div class="display-inline">
    <h1 class="order-1 mb-1 font-[Cera] text-3xl font-bold leading-7 text-white md:text-4xl">
      <span class="tracking-tight text-yellow-400">Loopy</span> Browser
    </h1>
    <h3 class="mb-6 text-sm text-slate-100 lg:text-base">Sample: {sample}</h3>
  </div>

  <div class="flex gap-x-4 text-right leading-6 text-slate-200">
    <p class="text-sm xl:text-base">
      Hover at any spots to see cell type inference/transcriptomic data.<br />Click to lock
      spot/point.
    </p>

    <div title="GitHub" class="flex-none items-center pr-6">
      <a
        target="_blank"
        href="https://github.com/chaichontat/libd-rotation/tree/main/visualize"
        rel="noopener"
        class="normal-case"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 512 512"
          class="inline-block h-6 w-6 fill-current transition-all hover:fill-white lg:h-8 lg:w-8"
        >
          <path
            d="M256,32C132.3,32,32,134.9,32,261.7c0,101.5,64.2,187.5,153.2,217.9a17.56,17.56,0,0,0,3.8.4c8.3,0,11.5-6.1,11.5-11.4,0-5.5-.2-19.9-.3-39.1a102.4,102.4,0,0,1-22.6,2.7c-43.1,0-52.9-33.5-52.9-33.5-10.2-26.5-24.9-33.6-24.9-33.6-19.5-13.7-.1-14.1,1.4-14.1h.1c22.5,2,34.3,23.8,34.3,23.8,11.2,19.6,26.2,25.1,39.6,25.1a63,63,0,0,0,25.6-6c2-14.8,7.8-24.9,14.2-30.7-49.7-5.8-102-25.5-102-113.5,0-25.1,8.7-45.6,23-61.6-2.3-5.8-10-29.2,2.2-60.8a18.64,18.64,0,0,1,5-.5c8.1,0,26.4,3.1,56.6,24.1a208.21,208.21,0,0,1,112.2,0c30.2-21,48.5-24.1,56.6-24.1a18.64,18.64,0,0,1,5,.5c12.2,31.6,4.5,55,2.2,60.8,14.3,16.1,23,36.6,23,61.6,0,88.2-52.4,107.6-102.3,113.3,8,7.1,15.2,21.1,15.2,42.5,0,30.7-.3,55.5-.3,63,0,5.4,3.1,11.5,11.4,11.5a19.35,19.35,0,0,0,4-.4C415.9,449.2,480,363.1,480,261.7,480,134.9,379.7,32,256,32Z"
          />
        </svg>
      </a>
    </div>
  </div>
</div>

<main class="flex flex-wrap gap-x-6 md:flex-nowrap">
  <Mapp />
  <Rna />
</main>
