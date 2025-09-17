<script lang="ts">
  import { sId, sMapp, sSample, userState } from '$lib/store';
  import type { Mapp } from '$lib/ui/mapp';
  import { Camera, EyeSlash } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { saveAs } from 'file-saver';
  import { toBlob } from 'html-to-image';
  import { tooltip } from '../utils';
  // import OverlayTool from './overlayTool.svelte'; // Dynamic import

  export let haveFeatures: boolean;
  let map: Mapp;
  $: map = $sMapp;
  $: showImgControl = $userState.showImgControl;

  function screenshot() {
    if (!map.map) return;
    const old = $sId.idx;
    $sId.idx = undefined;
    map.persistentLayers.active.visible = false;
    map.map.once('rendercomplete', async () => {
      const blob = await toBlob(
        map.map!.getTargetElement().parentElement!.parentElement!.parentElement!.parentElement!
          .parentElement!,
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

<section title="Map Tools" class="donotsave absolute right-9 top-2 z-20 flex gap-x-4">
  <!-- Overlay selector -->
  {#if showImgControl && haveFeatures}
    {#await import('./overlayTool.svelte') then overlayTool}
      <div
        class="inline-flex h-min flex-col gap-y-1 rounded-lg bg-neutral-800/80 p-2 px-3 text-sm font-medium backdrop-blur-lg dark:text-white/90"
      >
        <svelte:component this={overlayTool.default} {map} />
      </div>
    {/await}
  {/if}
</section>

<div class="mr-2 flex flex-col gap-y-4 md:gap-y-5 mt-1 md:mt-[56px] donotsave">
  <!-- Show/hide -->
  <button
    class="z-20"
    on:click={() => ($userState.showImgControl = !showImgControl)}
    use:tooltip={{ content: 'Show/hide' }}
    aria-label="Show/hide image controls"
  >
    <Icon src={EyeSlash} class="svg-icon size-5" />
  </button>

  <!-- Screenshot -->
  <button
    class="z-20"
    use:tooltip={{ content: 'Screenshot' }}
    on:click={screenshot}
    aria-label="Screenshot"
  >
    <Icon src={Camera} class="svg-icon size-5" />
  </button>
</div>
