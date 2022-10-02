<script lang="ts">
  import { getFileFromEvent, toCSV, toJSON } from '$lib/io';
  import { annotating, sEvent, sFeatureData, sMapp, sSample } from '$lib/store';
  import { tooltip } from '$lib/ui/utils';
  import { classes } from '$lib/utils';
  import type { Draww } from '$src/lib/sidebar/annotation/selector';
  import { ArrowUpOnSquare, Plus } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { schemeTableau10 } from 'd3';
  import { onMount } from 'svelte';

  export let toggled = true;
  let nPoints: Record<string, number> = { _total: 0 };

  //   $: updateAnnotating(toggled);
  //   function updateAnnotating(toggled: boolean) {
  //     if (!$sFeatureData?.coords) return;
  //     if (!$annotating.annotatingCoordName) {
  //       $annotating.annotatingCoordName = $sFeatureData.coords.name;
  //     }
  //     $annotating.annotating = toggled;
  //   }

  $: if ($sEvent?.type === 'sampleUpdated') {
    $sMapp.persistentLayers.rois.clear();
  }

  $: if (
    $sEvent?.type === 'featureUpdated' &&
    $annotating.annotating &&
    $annotating.annotatingCoordName !== $sFeatureData.coords.name
  ) {
    alert(
      `This feature has different points. Annotation not possible. Please select a feature with the same points or reset rois.`
    );
  }

  function handleNewKey(name: string | null) {
    if (name == null) {
      alert('Empty name.');
      return;
    }
    const newKey = name.trim();

    if ($annotating.keys.findIndex((v) => v === newKey) === -1) {
      $annotating.keys.push(newKey);
      $annotating.keys = $annotating.keys;
      return $annotating.keys.length - 1;
    }
    alert('Key already exists.');
    return $annotating.currKey;
  }

  let draw: Draww | undefined;

  $: map = $sMapp;
  $: sample = $sSample;

  onMount(async () => {
    await map.promise;
    map.persistentLayers.rois.draw.on('drawend', () => ($annotating.selecting = false));
    draw = map.persistentLayers.rois;
  });

  // Enable/disable polygon draw
  $: if (map.map) {
    if ($annotating.selecting) {
      map.map?.addInteraction(map.persistentLayers.rois.draw);
      map.map.getViewport().style.cursor = 'crosshair';
    } else {
      map.map.removeInteraction(map.persistentLayers.rois.draw);
      map.map.getViewport().style.cursor = 'default';
    }
  }
  const disabled =
    'disabled:cursor-auto disabled:bg-neutral-500 hover:disabled:bg-neutral-500 disabled:text-neutral-300';
</script>

<section class="flex flex-col gap-y-1">
  <div class="flex items-center">
    <!-- Select -->
    <div class="flex items-center gap-x-2">
      <button
        class={classes(
          'relative mr-4 flex items-center gap-x-0.5 rounded-lg py-1 px-3 font-medium shadow-lg transition-[background-color]',
          $annotating.selecting
            ? ' bg-orange-700 shadow-orange-700/30 hover:bg-orange-600'
            : 'bg-sky-800  shadow-sky-800/20 hover:bg-sky-700',
          disabled
        )}
        on:click={() => ($annotating.selecting = !$annotating.selecting)}
      >
        <!-- disabled={!$annotating.annotating || $annotating.keys.length === 0} -->
        {#if $annotating.selecting}
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-lg bg-orange-400 opacity-30 delay-200"
          />
          Stop Selecting
        {:else}
          <Icon
            src={Plus}
            class="-ml-1 mr-0.5 h-3 w-3 translate-y-[1px] stroke-current stroke-[2.5]"
          />
          Selections
        {/if}
      </button>

      <button
        class={classes(
          'relative mr-4 flex items-center gap-x-0.5 rounded-lg py-1 px-3 font-medium shadow-lg transition-[background-color]',
          $annotating.selecting
            ? ' bg-orange-700 shadow-orange-700/30 hover:bg-orange-600'
            : 'bg-sky-800  shadow-sky-800/20 hover:bg-sky-700',
          disabled
        )}
        on:click={() => ($annotating.selecting = !$annotating.selecting)}
      >
        <!-- disabled={!$annotating.annotating || $annotating.keys.length === 0} -->
        {#if $annotating.selecting}
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-lg bg-orange-400 opacity-30 delay-200"
          />
          Stop Selecting
        {:else}
          <Icon
            src={Plus}
            class="-ml-1 mr-0.5 h-3 w-3 translate-y-[1px] stroke-current stroke-[2.5]"
          />
          Circle
        {/if}
      </button>

      <button
        class={classes(
          'button my-0 h-full w-min bg-neutral-600 py-1 px-2 duration-75 hover:bg-neutral-500',
          disabled
        )}
        use:tooltip={{ content: 'Export ROIs as JSON' }}
        on:click={() => {
          toJSON(`rois_${$sSample.name}.json`, {
            rois: $sMapp.persistentLayers.rois.dump(),
            mPerPx: $sSample.imgParams?.mPerPx,
            sample: $sSample.name,
            time: new Date().toISOString()
          });
        }}
      >
        <!-- disabled={$annotating.keys.length === 0} -->
        <Icon src={ArrowUpOnSquare} class="svg-icon" />
      </button>
    </div>

    <div class="flex-grow" />
  </div>

  <div class="ml-4 flex items-center gap-x-3">
    {#each $annotating.keys as key, i}
      <label class="flex items-center gap-x-1 hover:underline">
        <div class="h-3 w-3" style={`background-color: ${schemeTableau10[i % 10]}`} />
        <button
          class={classes($annotating.currKey === i ? 'font-bold' : 'font-normal text-neutral-300')}
          on:click={() => ($annotating.currKey = i)}>{key}</button
        >
        {nPoints[key] ?? 0}
      </label>
    {/each}
  </div>
</section>
