<script lang="ts">
  import { sId, sSample } from '$lib/store';
  import { Camera, EyeSlash } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';
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
  class="donotsave absolute right-4 top-4 z-20 flex gap-x-4"
  class:top-16={width < 500 && showImgControl}
>
  <!-- Screenshot -->
  <button class="z-20 mt-1 h-9" use:tooltip={{ content: 'Screenshot' }} on:click={screenshot}>
    <Icon src={Camera} class="svg-icon h-6 w-6" />
  </button>

  <!-- Show/hide -->
  <button
    class="z-20 mt-1 h-9"
    class:pr-2={showImgControl}
    on:click={() => (showImgControl = !showImgControl)}
    use:tooltip={{ content: 'Show/hide' }}
  >
    <Icon src={EyeSlash} class="svg-icon h-6 w-6" />
  </button>

  <!-- Overlay selector -->
  <div>
    {#if (showImgControl && Object.keys($sSample?.coords ?? {}).length > 0) || Object.keys($sSample?.features ?? {}).length > 0}
      <OverlayTool {map} />
    {/if}
  </div>
</section>
