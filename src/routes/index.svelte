<script lang="ts">
  import { resizable } from '$lib/utils';
  import { byod } from '$src/lib/data/byod';
  import Nav from '$src/lib/nav.svelte';
  import { samples } from '$src/lib/store';
  import Maps from '$src/pages/maps.svelte';
  import Rna from '$src/pages/rna.svelte';
</script>

<svelte:head><title>Loopy Browser</title></svelte:head>

<!-- Search -->

<main
  class="flex flex-col overflow-x-hidden bg-slate-50 dark:divide-slate-800 dark:bg-slate-900 lg:h-screen lg:flex-row"
>
  <div class="relative h-[600px] w-full lg:h-full lg:w-[75%]">
    <div class="flex h-full w-full divide-x divide-y">
      {#if Object.keys($samples).length > 0}
        <Maps />
      {:else}
        <!-- Splash import -->
        <div
          class="flex items-center gap-x-2 lg:gap-x-3 cursor-pointer center text-slate-600 hover:text-slate-800 dark:text-slate-400 text-2xl sm:text-3xl lg:text-4xl transition-colors dark:hover:text-slate-200"
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
