<script lang="ts">
  import { getSample, getSampleListFromQuery } from '$lib/data/preload';
  import { isOnline } from '$lib/store';
  import Modal from '$src/lib/components/modal.svelte';
  import { processHandle } from '$src/lib/data/byod';
  import { samples } from '$src/lib/store';
  import Store from '$src/lib/store.svelte';
  import MainMap from '$src/pages/mainMap.svelte';
  import Splash from '$src/pages/splash.svelte';
  import { ArrowDown } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { onMount } from 'svelte';

  let loadExternal = false;
  onMount(() => {
    if (!navigator.userAgent.match(/chrome|chromium|crios/i)) {
      alert(
        'Loopy Browser is optimized for Google Chrome. Please use Google Chrome for the best experience.'
      );
    }

    // Load data from URL.
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

  // Drops
  function handleDrop(e: Event) {
    dragging = false;

    e.preventDefault();
    e.stopPropagation();

    const file = (e as DragEvent).dataTransfer?.items[0];
    if (!file) return;

    // https://developer.mozilla.org/en-US/docs/Web/API/DataTransferItem/getAsFileSystemHandle
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const handle = file.getAsFileSystemHandle() as Promise<
      FileSystemDirectoryHandle | FileSystemFileHandle
    >;
    processHandle(handle, true).catch(console.error);
  }
  let dragging = false;
  let dragTimeout: ReturnType<typeof setTimeout>;
</script>

<svelte:head><title>Loopy Browser</title></svelte:head>
<Store />

<main
  class="flex h-screen flex-col divide-neutral-800 overflow-x-hidden bg-neutral-900 md:flex-row"
  on:drop={handleDrop}
  on:dragenter={(e) => {
    if (dragTimeout) clearTimeout(dragTimeout); // Prevents flicker when drop div appears.
    e.preventDefault();
    dragging = true;
  }}
  on:dragover={(e) => {
    if (dragTimeout) clearTimeout(dragTimeout);
    e.preventDefault();
    dragging = true;
  }}
  on:dragleave={(e) => {
    e.preventDefault();
    dragTimeout = setTimeout(() => (dragging = false), 100);
  }}
>
  {#if Object.keys($samples).length > 0}
    <MainMap />
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
