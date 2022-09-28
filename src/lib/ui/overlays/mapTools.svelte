<script lang="ts">
  import { sId, sSample } from '$lib/store';
  import { saveAs } from 'file-saver';
  import { toBlob } from 'html-to-image';
  import type { Mapp } from '../mapp';
  import { tooltip } from '../utils';
  import OverlayTool from './overlayTool.svelte';

  export let map: Mapp;
  export let showImgControl: boolean;
  export let width = 0;

  function screenshot() {
    if (!map.map) return;
    const old = $sId.idx;
    $sId.idx = undefined;
    map.persistentLayers.active.visible = false;
    map.map.once('rendercomplete', async () => {
      const blob = await toBlob(
        map.map!.getTargetElement().parentElement!.parentElement!.parentElement!,
        {
          filter: (node) =>
            typeof node.className?.indexOf !== 'function' ||
            (node.className?.indexOf('donotsave') === -1 &&
              node.className?.indexOf('ol-zoom') === -1)
        }
      );
      saveAs(blob!, `${$sSample.name}.png`);
      $sId.idx = old;
      map.persistentLayers.active.visible = true;
    });
    map.map.renderSync();
  }
</script>

<section
  class="donotsave absolute right-4 top-4 z-20 flex gap-3"
  class:top-16={width < 500 && showImgControl}
>
  <!-- Screenshot -->
  <button class="z-20 mt-1 h-9" use:tooltip={{ content: 'Screenshot' }} on:click={screenshot}>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="1.5"
      stroke="currentColor"
      class="svg-icon h-6 w-6"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
      />
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
      />
    </svg>
  </button>

  <!-- Show/hide -->
  <button
    class="z-20 mt-1 h-9"
    class:pr-2={showImgControl}
    on:click={() => (showImgControl = !showImgControl)}
    use:tooltip={{ content: 'Show/hide' }}
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="svg-icon h-6 w-6" viewBox="0 0 24 24">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  </button>

  <!-- Overlay selector -->
  <div>
    {#if showImgControl}
      <OverlayTool {map} />
    {/if}
  </div>
</section>
