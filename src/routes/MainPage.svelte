<script lang="ts">
  import { getSample, getSampleListFromQuery } from '$lib/data/preload';
  import Modal from '$src/lib/components/modal.svelte';
  import { processHandle } from '$src/lib/data/byod';
  import type { Sample } from '$src/lib/data/objects/sample';
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
        `Samui is primarily tested on Google Chrome.
        Dragging and dropping files may not work on other browsers.
        Performance is known to be degraded in Firefox.
        If you face issues, please try Google Chrome.`.replace(/\s+/g, ' ')
      );
    }

    // Load data from URL.)
    const { urls, names } = getSampleListFromQuery(window.location.search);
    if (urls.length > 0) {
      loadExternal = true;
      const tempSamples: Record<string, Sample> = {};
      const promises = urls.map((url) =>
        getSample(url)
          .then((sample) => (tempSamples[sample.name] = sample))
          .catch(console.error)
      );

      Promise.all(promises)
        .then(() => {
          names.forEach((name) => $samples.push({ name, sample: tempSamples[name] }));
          $samples = $samples;
        })
        .catch(console.error);
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
  <title>Samui</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
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
  {#if $samples.length > 0}
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
