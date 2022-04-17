<script lang="ts">
  import promise from '$lib/meh';
  import SampleList from '$src/lib/components/sampleList.svelte';
  import SearchBox from '$src/lib/components/searchBox.svelte';
  import { activeSample, currRna, samples } from '$src/lib/store';
  import { debounce } from '$src/lib/utils';
  import Mapp from '$src/pages/mapp.svelte';
  import Rna from '$src/pages/rna.svelte';
  import { onMount } from 'svelte';

  let sample = '';
  promise ? promise[0]?.then((s) => (sample = s.name)).catch(console.error) : undefined;

  //   onMount(() => {
  //     // Query the element
  //     // Query the element
  //     const resizer = document.getElementById('dragMe')!;
  //     const leftSide = resizer.previousElementSibling!;
  //     const rightSide = resizer.nextElementSibling!;

  //     // The current position of mouse
  //     let x = 0;
  //     let y = 0;
  //     let leftWidth = 0;

  //     // Handle the mousedown event
  //     // that's triggered when user drags the resizer
  //     const mouseDownHandler = function (e) {
  //       // Get the current mouse position
  //       x = e.clientX;
  //       y = e.clientY;
  //       leftWidth = leftSide.getBoundingClientRect().width;

  //       // Attach the listeners to `document`
  //       document.addEventListener('mousemove', mouseMoveHandler);
  //       document.addEventListener('mouseup', mouseUpHandler);
  //     };

  //     const mouseMoveHandler = function (e) {
  //       // How far the mouse has been moved
  //       const dx = e.clientX - x;
  //       const dy = e.clientY - y;

  //       const newLeftWidth =
  //         ((leftWidth + dx) * 100) / resizer.parentNode.getBoundingClientRect().width;
  //       leftSide.style.width = `${newLeftWidth}%`;

  //       debounce(() => document.body.dispatchEvent(new Event('resize')), 50);

  //       resizer.style.cursor = 'col-resize';
  //       document.body.style.cursor = 'col-resize';

  //       leftSide.style.userSelect = 'none';
  //       leftSide.style.pointerEvents = 'none';

  //       rightSide.style.userSelect = 'none';
  //       rightSide.style.pointerEvents = 'none';
  //     };

  //     const mouseUpHandler = function () {
  //       resizer.style.removeProperty('cursor');
  //       document.body.style.removeProperty('cursor');

  //       leftSide.style.removeProperty('user-select');
  //       leftSide.style.removeProperty('pointer-events');

  //       rightSide.style.removeProperty('user-select');
  //       rightSide.style.removeProperty('pointer-events');

  //       // Remove the handlers of `mousemove` and `mouseup`
  //       document.removeEventListener('mousemove', mouseMoveHandler);
  //       document.removeEventListener('mouseup', mouseUpHandler);
  //     };

  //     // Attach the handler
  //     resizer.addEventListener('mousedown', mouseDownHandler);
  //   });
  //
</script>

<svelte:head><title>Loopy Browser</title></svelte:head>
<!--
<nav
  class="top-0 z-40 flex h-14 items-center justify-between gap-x-6 border-b border-b-gray-600 bg-gray-900/80 px-2 pt-2 pb-1 shadow backdrop-blur md:px-4"
>
  <h1
    class="display-inline font-[Cera] text-2xl font-bold leading-7 tracking-tight text-slate-100 md:text-3xl"
  >
    <span class="text-yellow-400">Loopy</span> Browser
  </h1>

  <div class="flex items-center gap-2 text-sm text-slate-100 lg:text-base">
    <div>Sample:</div>
    <SampleList items={Object.keys($samples)} on:change={(e) => ($activeSample = e.detail)} />
  </div>

  <div class="flex-grow" />

  <div class="w-[30%]">
    <SearchBox />
  </div>


</nav> -->

<!-- Search -->
<div
  class="absolute top-4 left-4 z-20 flex w-screen items-center justify-between text-sm text-slate-100 md:justify-start md:gap-6 lg:text-base"
>
  <div class="text-base md:text-lg xl:text-xl">
    <SearchBox />
  </div>
  <div class="flex items-center gap-x-2 pr-8 md:pr-0">
    <div>Sample:</div>
    <SampleList items={Object.keys($samples)} on:change={(e) => ($activeSample = e.detail)} />
  </div>
</div>

<main class="flex flex-col divide-x-2 divide-gray-800 md:h-screen md:flex-row md:flex-nowrap">
  <div class="h-[600px] flex-grow shadow md:h-full">
    <Mapp />
  </div>

  <!-- <div class="resizer h-full w-1 cursor-ew-resize bg-white" id="dragMe" /> -->
  <div class="flex max-w-[600px] flex-col px-6 pt-3 md:w-[35%]">
    <!-- Nav -->
    <div class="hidden md:flex md:items-center">
      <div class="mt-2 text-xl font-medium">Navigation: Showing {$currRna.name}</div>
      <div class="flex-grow" />
      <div title="GitHub" class="">
        <a
          target="_blank"
          href="https://github.com/chaichontat/loopy-browser"
          rel="noopener"
          class="normal-case"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
            class="inline-block h-6 w-6 fill-current transition-all hover:fill-white lg:h-8 lg:w-8"
          >
            <path
              d="M256,32C132.3,32,32,134.9,32,261.7c0,101.5,64.2,187.5,153.2,217.9a17.56,17.56,0,0,0,3.8.4c8.3,0,11.5-6.1,11.5-11.4,0-5.5-.2-19.9-.3-39.1a102.4,102.4,0,0,1-22.6,2.7c-43.1,0-52.9-33.5-52.9-33.5-10.2-26.5-24.9-33.6-24.9-33.6-19.5-13.7-.1-14.1,1.4-14.1h.1c22.5,2,34.3,23.8,34.3,23.8,11.2,19.6,26.2,25.1,39.6,25.1a63,63,0,0,0,25.6-6c2-14.8,7.8-24.9,14.2-30.7-49.7-5.8-102-25.5-102-113.5,0-25.1,8.7-45.6,23-61.6-2.3-5.8-10-29.2,2.2-60.8a18.64,18.64,0,0,1,5-.5c8.1,0,26.4,3.1,56.6,24.1a208.21,208.21,0,0,1,112.2,0c30.2-21,48.5-24.1,56.6-24.1a18.64,18.64,0,0,1,5,.5c12.2,31.6,4.5,55,2.2,60.8,14.3,16.1,23,36.6,23,61.6,0,88.2-52.4,107.6-102.3,113.3,8,7.1,15.2,21.1,15.2,42.5,0,30.7-.3,55.5-.3,63,0,5.4,3.1,11.5,11.4,11.5a19.35,19.35,0,0,0,4-.4C415.9,449.2,480,363.1,480,261.7,480,134.9,379.7,32,256,32Z"
            />
          </svg>
        </a>
      </div>
    </div>

    <Rna />
  </div>
</main>
