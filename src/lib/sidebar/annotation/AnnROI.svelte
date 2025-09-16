<script lang="ts">
  import { toJSON } from '$lib/io';
  import { annoROI, sMapp, sSample } from '$lib/store';
  import { tooltip } from '$lib/ui/utils';
  import { classes } from '$lib/utils';
  import { ArrowUpOnSquare, PlusSmall } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';
  import SharedAnnotate from './SharedAnnotate.svelte';
  import AnnoButton from './annoButton.svelte';
</script>

<SharedAnnotate store={annoROI} draw={$sMapp.persistentLayers.rois}>
  <AnnoButton
    class={'bg-blue-700 shadow-blue-700/20 hover:bg-blue-600'}
    ping={$annoROI.selecting === 'Point'}
    disabled={($annoROI.selecting !== undefined && $annoROI.selecting !== 'Point') ||
      $annoROI.keys.length === 0}
    onClick={() => {
      $sMapp.persistentLayers.rois.changeDrawType('Point');
      $annoROI.selecting = $annoROI.selecting ? undefined : 'Point';
    }}
  >
    <Icon
      src={PlusSmall}
      class="-ml-1 mr-0.5 h-3 w-3 translate-y-px stroke-current stroke-[2.5]"
    />
    Point
  </AnnoButton>

  <button
    class={classes(
      'button my-0 h-full w-min bg-neutral-600 py-1 px-2 duration-75 hover:bg-neutral-500',
      'disabled:cursor-auto disabled:bg-neutral-500 hover:disabled:bg-neutral-500 disabled:text-neutral-300'
    )}
    use:tooltip={{ content: 'Export ROIs as JSON' }}
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
    <Icon src={ArrowUpOnSquare} class="svg-icon" />
  </button>
</SharedAnnotate>
