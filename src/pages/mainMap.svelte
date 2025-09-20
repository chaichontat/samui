<script lang="ts">
  import { mapTiles, sMapp, sSample } from '$lib/store';
  // import Colorbar from '$src/lib/components/colorbar.svelte'; // Dynamic import
  import type { Hierarchy } from '$lib/mapTile';
  import MapTools from '$src/lib/ui/overlays/mapTools.svelte';
  import { resizable } from '$src/lib/ui/utils';
  import { classes } from '$src/lib/utils';
  import MapTile from '$src/pages/mapTile.svelte';
  // import Sidebar from '$src/pages/sidebar.svelte'; // Dynamic import
  import { Menu } from '@lucide/svelte';

  let hie: Hierarchy = { root: true, maps: $mapTiles };

  $: haveFeatures =
    Object.keys($sSample?.coords ?? {}).length > 0 ||
    Object.keys($sSample?.features ?? {}).length > 0;

  $: showSidebar = haveFeatures;

  const updateSize = () => $sMapp.map?.updateSize();
  let shownOnce = false;
  $: if (showSidebar) shownOnce = true;
  $: if ($sMapp && (showSidebar || !showSidebar)) setTimeout(updateSize, 10);
</script>

<svelte:head><title>Samui {$sSample?.name ? `- ${$sSample.name}` : ''}</title></svelte:head>

<div
  class={classes(
    'relative w-full overflow-hidden',
    showSidebar ? 'h-[65%] md:h-full md:w-[75%]' : 'h-screen'
  )}
>
  <button class="absolute top-6 right-3 z-40 size-5" on:click={() => (showSidebar = !showSidebar)}>
    <Menu class="svg-icon h-6 w-6" />
  </button>

  <article class="h-full w-full" id="allMaps">
    <MapTile {hie} />

    <div class="absolute top-[60px] right-1 md:top-2">
      <MapTools {haveFeatures} />
    </div>

    {#if haveFeatures}
      {#await import('$src/lib/components/colorbar.svelte') then colorbar}
        <div class="absolute right-6 bottom-4 z-20 active:pointer-events-none">
          <svelte:component this={colorbar.default} />
        </div>
      {/await}
    {/if}
  </article>
</div>

{#if showSidebar || shownOnce}
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
    {#await import('$src/pages/sidebar.svelte') then sidebar}
      <svelte:component this={sidebar.default} />
    {/await}
  </aside>
{/if}
