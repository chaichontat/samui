<script lang="ts">
  import { dev } from '$app/environment';
  import { getSample, getSampleListFromQuery } from '$lib/data/preload';
  import Modal from '$src/lib/components/modal.svelte';
  import { processHandle } from '$src/lib/data/byod';
  import { samples } from '$src/lib/store';
  import Store from '$src/lib/store.svelte';
  // import MainMap from '$src/pages/mainMap.svelte';
  import Splash from '$src/pages/splash.svelte';
  import { ArrowDown, Cog } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { onMount } from 'svelte';

  export let loadExternal: boolean;

  onMount(() => {
    if (!navigator.userAgent.match(/chrome|chromium|crios/i)) {
      alert(
        `Loopy Browser is optimized for Google Chrome.
        Dragging and dropping files may not work on other browsers.
        If you face issues, please try Google Chrome.`
      );
    }

    // Load data from URL.
    const urls = getSampleListFromQuery(window.location.search);
    if (urls.length > 0) {
      loadExternal = true;
      for (const url of urls) {
        getSample(url)
          .then((sample) => ($samples[sample.name] = sample))
          .catch(console.error);
      }
    } else {
      loadExternal = false;
    }
  });

  // Drops
  function handleDrop(e: Event) {
    dragging = false;
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

<svelte:head>
  <title>Loopy Browser</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <!-- Hotjar Tracking Code for https://loopybrowser.com -->
  {#if !dev}
    <script>
      (function (h, o, t, j, a, r) {
        h.hj =
          h.hj ||
          function () {
            (h.hj.q = h.hj.q || []).push(arguments);
          };
        h._hjSettings = { hjid: 3184521, hjsv: 6 };
        a = o.getElementsByTagName('head')[0];
        r = o.createElement('script');
        r.async = 1;
        r.src = t + h._hjSettings.hjid + j + h._hjSettings.hjsv;
        a.appendChild(r);
      })(window, document, 'https://static.hotjar.com/c/hotjar-', '.js?sv=');
    </script>
  {/if}
</svelte:head>

<Store />

<main
  class="flex h-screen flex-col divide-neutral-800 overflow-x-hidden bg-neutral-900 md:flex-row"
  on:drop|preventDefault={handleDrop}
  on:dragenter|preventDefault={() => {
    if (dragTimeout) clearTimeout(dragTimeout); // Prevents flicker when drop div appears.
    dragging = true;
  }}
  on:dragover|preventDefault={() => {
    if (dragTimeout) clearTimeout(dragTimeout);
    dragging = true;
  }}
  on:dragleave|preventDefault={() => {
    dragTimeout = setTimeout(() => (dragging = false), 100);
  }}
>
  {#if Object.keys($samples).length > 0}
    {#await import('$src/pages/mainMap.svelte') then MainMap}
      <svelte:component this={MainMap.default} />
    {/await}
  {:else if loadExternal}
    <Modal>
      <Icon src={Cog} class="svg-icon h-12 w-12 stroke-1 animate-spin stroke-blue-200" /> Loading data...
    </Modal>
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
