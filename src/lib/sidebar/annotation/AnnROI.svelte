<script lang="ts">
  import { toJSON } from '$lib/io';
  import { annoROI, sMapp, sSample } from '$lib/store';
  import { tooltip } from '$lib/ui/utils';
  import { classes } from '$lib/utils';
  import { Plus, SquareArrowDown } from '@lucide/svelte';
  import SharedAnnotate from './SharedAnnotate.svelte';
  import AnnoButton from './annoButton.svelte';
</script>

<SharedAnnotate store={annoROI} draw={$sMapp.persistentLayers.rois}>
  <AnnoButton
    class="bg-blue-700 shadow-blue-700/20 hover:bg-blue-600"
    ping={$annoROI.selecting === 'Point'}
    disabled={($annoROI.selecting !== undefined && $annoROI.selecting !== 'Point') ||
      $annoROI.keys.length === 0}
    onClick={() => {
      $sMapp.persistentLayers.rois.changeDrawType('Point');
      $annoROI.selecting = $annoROI.selecting ? undefined : 'Point';
    }}
  >
    <Plus
      class="-ml-1 mr-0.5 h-3 w-3 translate-y-px stroke-current stroke-[2.5]"
      stroke-width={2.5}
    />
    Point
  </AnnoButton>

  <div class="flex-1"></div>

  <button
    class={classes(
      'rounded-lg h-7 bg-neutral-600 py-1 px-2 duration-75 hover:bg-neutral-500',
      'disabled:cursor-auto disabled:bg-neutral-500 disabled:opacity-50 hover:disabled:bg-neutral-500 disabled:text-neutral-300'
    )}
    use:tooltip={{ content: 'Export ROIs as JSON' }}
    data-testid="roi-export"
    on:click={() => {
      toJSON(`rois_${$sSample.name}.json`, {
        ...$sMapp.persistentLayers.rois.dump(),
        mPerPx: $sSample.imgParams?.mPerPx,
        sample: $sSample.name,
        time: new Date().toISOString()
      });
    }}
    disabled={$annoROI.keys.length === 0}
  >
    <SquareArrowDown class="svg-icon" stroke-width={2.5} />
  </button>
</SharedAnnotate>
