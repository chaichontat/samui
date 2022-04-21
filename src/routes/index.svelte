<script lang="ts">
  import { resizable } from '$lib/utils';
  import SampleList from '$src/lib/components/sampleList.svelte';
  import SearchBox from '$src/lib/components/searchBox.svelte';
  import Nav from '$src/lib/nav.svelte';
  import { activeSample, samples } from '$src/lib/store';
  import Mapp from '$src/pages/mapp.svelte';
  import Rna from '$src/pages/rna.svelte';

  async function readFile<T>(
    dirHandle: FileSystemDirectoryHandle,
    name: string,
    mode: 'chunked' | 'plain'
  ): Promise<T | ArrayBuffer> {
    const file = await dirHandle.getFileHandle(name).then((fileHandle) => fileHandle.getFile());

    if (mode === 'plain') {
      return JSON.parse(await file.text()) as T;
    } else {
      return await file.arrayBuffer();
    }
  }

  async function byod() {
    if (!('showDirectoryPicker' in window)) {
      alert('This browser does not support the File System API. Use Chrome/Safari.');
      return;
    }
    const directoryHandle = await window.showDirectoryPicker();

    readFile(directoryHandle, 'sample.json', 'plain')
      .then((samples) => {
        console.log(samples);
      })
      .catch(console.error);

    for await (const entry of directoryHandle.values()) {
      console.log(entry.kind, entry.name);
    }
  }
</script>

<svelte:head><title>Loopy Browser</title></svelte:head>

<!-- Search -->

<main
  class="flex flex-col overflow-x-hidden bg-slate-50 dark:divide-slate-800 dark:bg-slate-900 lg:h-screen lg:flex-row"
>
  <div
    class="absolute top-4 left-4 z-20 flex max-w-[48rem] items-center justify-between gap-6 text-sm md:text-base"
  >
    <div class="mt-1 text-base lg:text-lg xl:text-xl">
      <SearchBox />
    </div>
    <div class="flex items-center gap-x-2 pr-4 lg:pr-0">
      <div class="font-semibold text-slate-900 dark:font-medium dark:text-slate-100">Sample:</div>
      <SampleList items={Object.keys($samples)} on:change={(e) => ($activeSample = e.detail)} />
    </div>
    <!-- Upload your data -->
    <button
      class="group relative mb-2 mr-2 inline-flex items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 p-0.5 text-sm font-medium text-gray-900 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-200 group-hover:from-cyan-500 group-hover:to-blue-500 dark:text-white dark:focus:ring-cyan-800"
      on:click={byod}
    >
      <span
        class="relative rounded-md bg-white px-5 py-2 transition-all duration-75 ease-in group-hover:bg-opacity-0 dark:bg-gray-900"
      >
        Run your Data
      </span>
    </button>
  </div>
  <div class="h-[600px] w-full lg:h-full lg:w-[75%]"><Mapp /></div>

  <div class="resizer h-full w-1 cursor-ew-resize bg-gray-200 dark:bg-gray-800" use:resizable />
  <aside class="flex h-full flex-1 flex-col pt-2">
    <Nav />
    <section class="h-full overflow-y-auto">
      <Rna />
    </section>
  </aside>
</main>
