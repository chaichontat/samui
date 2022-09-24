<script lang="ts">
  import { mapTiles } from '$lib/store';
  import { samples } from '$src/lib/store';
  import Store from '$src/lib/store.svelte';
  import { resizable } from '$src/lib/ui/utils';
  import type { Hierarchy } from '$src/pages/mapTile';
  import MapTile from '$src/pages/mapTile.svelte';
  import Sidebar from '$src/pages/sidebar.svelte';
  import Splash from '$src/pages/splash.svelte';
  import { onMount } from 'svelte';

  let hie: Hierarchy = { root: true, maps: $mapTiles };

  // Load data from URL.
  // onMount(() => {
  //   for (const url of getSampleList(window.location.search)) {
  //     getSample(url)
  //       .then((sample) => ($samples[sample.name] = sample))
  //       .catch(console.error);
  //   }
  // });
</script>

<svelte:head><title>Loopy Browser</title></svelte:head>
<Store />

<!-- Search -->

<main
  class="flex flex-col overflow-x-hidden bg-slate-50 dark:divide-slate-800 dark:bg-slate-900 lg:h-screen lg:flex-row"
>
  {#if Object.keys($samples).length > 0}
    <div class="relative h-[600px] w-full overflow-hidden lg:h-full lg:w-[75%]">
      <article class="h-full w-full" id="allMaps">
        <MapTile {hie} />
      </article>
    </div>

    <div class="resizer h-full w-1 cursor-ew-resize bg-gray-200 dark:bg-gray-800" use:resizable />
    <Sidebar />
  {:else}
    <Splash />
  {/if}
</main>
