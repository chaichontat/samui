<script lang="ts">
  import { mapTiles, sMapp, sSample } from '$lib/store';
  import Colorbar from '$src/lib/components/colorbar.svelte';
  import MapTools from '$src/lib/ui/overlays/mapTools.svelte';
  import { resizable } from '$src/lib/ui/utils';
  import { classes } from '$src/lib/utils';
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

<div
  class={classes(
    'relative w-full overflow-hidden',
    showSidebar ? 'h-[65%] md:h-full md:w-[75%]' : 'h-screen'
  )}
>
  <button class="absolute top-6 right-4 z-40" on:click={() => (showSidebar = !showSidebar)}>
    <Icon src={Bars3} class="svg-icon h-6 w-6" />
  </button>

  <article class="h-full w-full" id="allMaps">
    <MapTile {hie} />

    <div class="pointer-events-none absolute right-6 bottom-4 z-20">
      <Colorbar />
    </div>

    <div class="absolute top-[60px] right-1 md:top-2">
      <MapTools />
    </div>
  </article>
</div>

<div
  class={classes(
    'hidden w-0.5 cursor-ew-resize bg-neutral-800 md:h-full',
    showSidebar ? ' md:block' : ''
  )}
  use:resizable
/>

<!-- Sidebar -->
<aside
  class={classes(
    'relative flex w-full flex-1 flex-col overflow-hidden overflow-y-scroll',
    showSidebar ? 'md:h-full' : 'hidden'
  )}
>
  <!-- <div class=""> -->
  <Sidebar bind:showSidebar />
  <!-- </div> -->
</aside>
