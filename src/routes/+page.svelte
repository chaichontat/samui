<script lang="ts">
  import { isOnline, mapTiles } from '$lib/store';
  import Dragdrop from '$src/lib/components/dragdrop.svelte';
  import { processFolder } from '$src/lib/data/byod';
  import { samples } from '$src/lib/store';
  import Store from '$src/lib/store.svelte';
  import { resizable } from '$src/lib/ui/utils';
  import type { Hierarchy } from '$src/pages/mapTile';
  import MapTile from '$src/pages/mapTile.svelte';
  import Sidebar from '$src/pages/sidebar.svelte';
  import Splash from '$src/pages/splash.svelte';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';

  let hie: Hierarchy = { root: true, maps: $mapTiles };

  // Load data from URL.
  // onMount(() => {
  //   for (const url of getSampleList(window.location.search)) {
  //     getSample(url)
  //       .then((sample) => ($samples[sample.name] = sample))
  //       .catch(console.error);
  //   }
  // })

  onMount(() => {
    if (!navigator.userAgent.match(/chrome|chromium|crios/i)) {
      alert(
        'Loopy Browser is optimized for Google Chrome. Please use Google Chrome for the best experience.'
      );
    }
  });

  function handleDrop(e: Event) {
    dragging = false;

    e.preventDefault();
    e.stopPropagation();

    if (get(isOnline)) {
      alert('You cannot add samples while browsing web-based sample(s).');
      return;
    }

    const file = (e as DragEvent).dataTransfer?.items[0];
    if (!file) return;

    // https://developer.mozilla.org/en-US/docs/Web/API/DataTransferItem/getAsFileSystemHandle
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const handle = file.getAsFileSystemHandle() as Promise<FileSystemDirectoryHandle>;
    processFolder(handle).catch(console.error);
  }
  let dragging = false;
  let timeout: ReturnType<typeof setTimeout>;

  $: console.log(dragging);
</script>

<svelte:head><title>Loopy Browser</title></svelte:head>
<Store />

<!-- Search -->

<main
  class="flex flex-col overflow-x-hidden bg-slate-50 dark:divide-slate-800 dark:bg-slate-900 lg:h-screen lg:flex-row"
  on:drop={handleDrop}
  on:dragenter={(e) => {
    if (timeout) clearTimeout(timeout); // Prevents flicker when drop div appears.
    e.preventDefault();
    dragging = true;
  }}
  on:dragover={(e) => {
    if (timeout) clearTimeout(timeout);
    e.preventDefault();
    dragging = true;
  }}
  on:dragleave={(e) => {
    e.preventDefault();
    timeout = setTimeout(() => (dragging = false), 100);
  }}
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

  {#if dragging}
    <Dragdrop />
  {/if}
</main>
