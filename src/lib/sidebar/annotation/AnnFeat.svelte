<script lang="ts">
  import { toCSV } from '$lib/io';
  import { annoFeat, sFeatureData, sMapp, sSample } from '$lib/store';
  import { tooltip } from '$lib/ui/utils';
  import { classes } from '$lib/utils';
  import { ArrowUpOnSquare, CursorArrowRays } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';
  import AnnoButton from './annoButton.svelte';
  import SharedAnnotate from './SharedAnnotate.svelte';

  // Fix starting coord.
  $: if (!$annoFeat.annotatingCoordName && $annoFeat.keys.length) {
    $annoFeat.annotatingCoordName = $sFeatureData.coords.name;
  }

  const labelClass = 'bg-violet-800 shadow-violet-800/20 hover:bg-violet-700';
  const buttonClass = 'bg-fuchsia-800 shadow-fuchsia-800/20 hover:bg-fuchsia-700';

  const out = () =>
    toCSV(
      `annotations_${$sSample.name}_${$annoFeat.annotatingCoordName!}.csv`,
      $sMapp.persistentLayers.annotations.dumpPoints()
    );

  $: $sMapp.persistentLayers.annotations.points.visible = $annoFeat.show;
</script>

<SharedAnnotate
  store={annoFeat}
  draw={$sMapp.persistentLayers.annotations}
  {labelClass}
  {buttonClass}
>
  <AnnoButton
    class={buttonClass}
    ping={$annoFeat.selecting === 'Select'}
    disabled={($annoFeat.selecting !== undefined && $annoFeat.selecting !== 'Select') ||
      $annoFeat.keys.length === 0}
    onClick={() => {
      $annoFeat.selecting = $annoFeat.selecting ? undefined : 'Select';
    }}
  >
    <Icon
      src={CursorArrowRays}
      class="-ml-1 mr-0.5 h-3 w-3 translate-y-[1px] stroke-current stroke-[2.5]"
    />
    Select
  </AnnoButton>

  <button
    class={classes(
      'button my-0 h-full w-min bg-neutral-600 py-1 px-2 duration-75 hover:bg-neutral-500',
      'disabled:cursor-auto disabled:bg-neutral-500 hover:disabled:bg-neutral-500 disabled:text-neutral-300'
    )}
    use:tooltip={{ content: 'Export annotated points as CSV' }}
    disabled={$annoFeat.keys.length === 0}
    on:click={out}
  >
    <Icon src={ArrowUpOnSquare} class="svg-icon" />
  </button>
</SharedAnnotate>

<div class="mt-2">
  {!$annoFeat.annotatingCoordName
    ? 'Not annotating.'
    : $annoFeat.keys.length === 0
    ? 'Add labels to start annoFeat.'
    : $annoFeat.selecting
    ? `Selecting ${$annoFeat.annotatingCoordName}.`
    : `Click on points or add selections to annotate ${$annoFeat.annotatingCoordName}.`}
</div>
<div class="flex">
  <div class="flex-grow" />
  <div class="flex items-center gap-x-2">
    <label>
      <input class="translate-y-0.5" type="checkbox" bind:checked={$annoFeat.show} />
      Show overlay
    </label>
  </div>
</div>
