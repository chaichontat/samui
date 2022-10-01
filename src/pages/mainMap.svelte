<script lang="ts">
  import { mapTiles, sMapp, sSample } from '$lib/store';
  import Colorbar from '$src/lib/components/colorbar.svelte';
  import MapTools from '$src/lib/ui/overlays/mapTools.svelte';
  import { resizable } from '$src/lib/ui/utils';
  import type { Hierarchy } from '$src/pages/mapTile';
  import MapTile from '$src/pages/mapTile.svelte';
  import Sidebar from '$src/pages/sidebar.svelte';
  import { Bars3 } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';

  let hie: Hierarchy = { root: true, maps: $mapTiles };

  $: showSidebar =
    Object.keys($sSample?.coords ?? {}).length > 0 ||
    Object.keys($sSample?.features ?? {}).length > 0;

  const updateSize = () => $sMapp.map?.updateSize();
  $: if ($sMapp && (showSidebar || !showSidebar)) setTimeout(updateSize, 10);
</script>

<div class="relative h-[600px] w-full overflow-hidden lg:h-full" class:lg:w-[75%]={showSidebar}>
  <button class="absolute top-6 right-4 z-40" on:click={() => (showSidebar = !showSidebar)}>
    <Icon src={Bars3} class="svg-icon h-6 w-6" />
  </button>

  <article class="h-full w-full" id="allMaps">
    <MapTile {hie} />

    <div class="pointer-events-none absolute right-6 bottom-4 z-20">
      <Colorbar />
    </div>

    <div class="absolute top-2 right-1">
      <MapTools />
    </div>
  </article>
</div>

<!-- Sidebar -->
<div
  class="resizer h-full w-1 cursor-ew-resize bg-neutral-200 dark:bg-neutral-800"
  class:hidden={!showSidebar}
  use:resizable
/>
<aside
  class="relative flex h-full w-full flex-1 flex-col overflow-y-auto"
  class:hidden={!showSidebar}
>
  <Sidebar bind:showSidebar />
</aside>
