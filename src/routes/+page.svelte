<script lang="ts">
  import { getSample, getSampleListFromQuery } from '$lib/data/preload';
  import { isOnline, mapTiles, sSample } from '$lib/store';
  import Modal from '$src/lib/components/modal.svelte';
  import { processFolder } from '$src/lib/data/byod';
  import { samples } from '$src/lib/store';
  import Store from '$src/lib/store.svelte';
  import { resizable } from '$src/lib/ui/utils';
  import type { Hierarchy } from '$src/pages/mapTile';
  import MapTile from '$src/pages/mapTile.svelte';
  import Sidebar from '$src/pages/sidebar.svelte';
  import Splash from '$src/pages/splash.svelte';
  import { ArrowDown } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';

  let hie: Hierarchy = { root: true, maps: $mapTiles };

  // Load data from URL.
  let loadExternal = false;
  onMount(() => {
    const urls = getSampleListFromQuery(window.location.search);
    if (urls.length > 0) {
      loadExternal = true;
      for (const url of getSampleListFromQuery(window.location.search)) {
        getSample(url)
          .then((sample) => ($samples[sample.name] = sample))
          .catch(console.error);
      }
    }
  });

  let promise: Promise<void> | null = null;
  onMount(() => {
    promise = new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 50);
    });
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

  $: showSidebar =
    Object.keys($sSample?.coords ?? {}).length > 0 ||
    Object.keys($sSample?.features ?? {}).length > 0;
</script>

<svelte:head><title>Loopy Browser</title></svelte:head>
<Store />

{#if promise}
  {#await promise then _}
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
        <div
          class="relative h-[600px] w-full overflow-hidden lg:h-full"
          class:lg:w-[75%]={showSidebar}
        >
          <article class="h-full w-full" id="allMaps">
            <MapTile {hie} />
          </article>
        </div>

        {#if showSidebar}
          <div
            class="resizer h-full w-1 cursor-ew-resize bg-gray-200 dark:bg-gray-800"
            use:resizable
          />
          <Sidebar />
        {/if}
      {:else if loadExternal}
        <Modal animateIn={false}>Loading data...</Modal>
      {:else}
        <Splash />
      {/if}

      {#if dragging}
        <Modal>
          <div class="mb-2 animate-bounce rounded-full bg-blue-600 p-[10px] drop-shadow-xl">
            <Icon src={ArrowDown} class="h-8 w-8 stroke-current stroke-[3]" />
          </div>
          Drop Sample Here
        </Modal>
      {/if}
    </main>
  {/await}
{/if}
