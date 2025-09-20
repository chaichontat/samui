<script lang="ts">
  import { sId, sMapp, sSample, userState } from '$lib/store';
  import type { Mapp } from '$lib/ui/mapp';
  import GlassIsland from '$src/lib/components/glass/GlassIsland.svelte';
  import { Camera, EyeOff } from '@lucide/svelte';
  import { saveAs } from 'file-saver';
  import { scale } from 'svelte/transition';
  import { tooltip } from '../utils';

  export let haveFeatures: boolean;
  let map: Mapp;
  $: map = $sMapp;
  $: showImgControl = $userState.showImgControl;

  let htmlToImageModule: typeof import('html-to-image') | undefined;

  async function loadHtmlToImage() {
    if (!htmlToImageModule) {
      htmlToImageModule = await import('html-to-image');
    }
    return htmlToImageModule;
  }

  async function screenshot() {
    if (!map.map) return;
    const { toBlob } = await loadHtmlToImage();
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
      <div transition:scale={{ duration: 200, start: 0.85 }} class="inline-flex">
        <GlassIsland
          class="relative group overflow-hidden px-2   py-1.5 text-sm font-medium text-white/90"
          baseWidth={280}
          baseHeight={160}
          expandWidthRatio={1}
          expandHeightRatio={1.05}
          expanded={true}
          highlight={true}
          interactiveTilt={false}
          glassBorderWidth={0}
        >
          <div class="relative flex flex-col gap-y-1">
            <svelte:component this={overlayTool.default} {map} />
          </div>
        </GlassIsland>
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
    <EyeOff class="svg-icon size-5" />
  </button>

  <!-- Screenshot -->
  <button
    class="z-20"
    use:tooltip={{ content: 'Screenshot' }}
    on:click={screenshot}
    aria-label="Screenshot"
  >
    <Camera class="svg-icon size-5" />
  </button>
</div>
