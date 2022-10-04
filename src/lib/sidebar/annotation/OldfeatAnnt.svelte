<script lang="ts">
  import { getFileFromEvent, toCSV, toJSON } from '$lib/io';
  import { annoFeat, sEvent, sFeatureData, sMapp, sSample } from '$lib/store';
  import { tooltip } from '$lib/ui/utils';
  import { classes } from '$lib/utils';
  import type { DrawFeature, Draww } from '$src/lib/sidebar/annotation/annROI';
  import type { Mapp } from '$src/lib/ui/mapp';
  import { ArrowUpOnSquare, Plus } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { schemeTableau10 } from 'd3';
  import { onMount } from 'svelte';

  export let toggled: boolean;
  let nPoints: Record<string, number> = { _total: 0 };

  $: updateannoFeat(toggled);
  function updateannoFeat(toggled: boolean) {
    if (!$sFeatureData?.coords) return;
    if (!$annoFeat.annotatingCoordName) {
      $annoFeat.annotatingCoordName = $sFeatureData.coords.name;
    }
    // $annoFeat.annotatingCoordName = toggled;
  }

  $: if ($sEvent?.type === 'sampleUpdated') {
    toggled = false;
    $sMapp.persistentLayers.annotations.clear();
  }

  $: if (
    $sEvent?.type === 'featureUpdated' &&
    $annoFeat.annotating &&
    $annoFeat.annotatingCoordName !== $sFeatureData.coords.name
  ) {
    alert(
      `This feature has different points. Annotation not possible. Please select a feature with the same points or reset annotations.`
    );
  }

  function handleNewKey(name: string | null) {
    if (name == null) {
      alert('Empty name.');
      return;
    }
    const newKey = name.trim();

    if ($annoFeat.keys.findIndex((v) => v === newKey) === -1) {
      $annoFeat.keys.push(newKey);
      $annoFeat.keys = $annoFeat.keys;
      return $annoFeat.keys.length - 1;
    }
    alert('Key already exists.');
    return $annoFeat.currKey;
  }

  let draw: DrawFeature | undefined;
  let map: Mapp;
  $: map = $sMapp;
  $: sample = $sSample;

  onMount(async () => {
    await map.promise;
    map.persistentLayers.annotations.draw.on('drawend', () => ($annoFeat.selecting = false));
    draw = map.persistentLayers.annotations;
  });

  // Enable/disable polygon draw
  $: if (map.map) {
    if ($annoFeat.selecting && $annoFeat.annotatingCoordName) {
      if ($annoFeat.currKey == undefined) {
        alert('Set annotation name first');
        $annoFeat.selecting = false;
      } else {
        map.map?.addInteraction(map.persistentLayers.annotations.draw);
        map.map.getViewport().style.cursor = 'crosshair';
      }
    } else {
      map.map.removeInteraction(map.persistentLayers.annotations.draw);
      map.map.getViewport().style.cursor = 'default';
    }
  }

  $: if (['pointsAdded', 'sampleUpdated'].includes($sEvent?.type)) {
    nPoints = {
      _total: $sMapp.persistentLayers.annotations.points.length,
      ...$sMapp.persistentLayers.annotations.points.getComposition()
    };
  }
  const disabled =
    'disabled:cursor-auto disabled:bg-neutral-500 hover:disabled:bg-neutral-500 disabled:text-neutral-300';
</script>

<section class="flex flex-col gap-y-1">
  <!-- Labels -->
  <div class="flex items-center">
    <button
      class={classes(
        'mr-4 flex items-center gap-x-0.5 rounded-lg bg-blue-700 py-1 pl-2 pr-3 font-medium transition-colors hover:bg-blue-600',
        disabled
      )}
      on:click={() => ($annoFeat.currKey = handleNewKey(prompt('Enter new key.')))}
      disabled={$annoFeat.selecting || !$annoFeat.annotatingCoordName}
    >
      <Icon src={Plus} class="mr-0.5 h-3 w-3 translate-y-[1px] stroke-current stroke-[2.5]" />
      Label
    </button>

    <!-- Select -->
    <div class="flex items-center gap-x-2">
      <button
        class={classes(
          'relative mr-4 flex items-center gap-x-0.5 rounded-lg py-1 px-3 font-medium transition-[background-color]',
          $annoFeat.selecting
            ? ' bg-orange-700 hover:bg-orange-600'
            : 'bg-emerald-700  hover:bg-emerald-600',
          disabled
        )}
        disabled={!$annoFeat.annotatingCoordName || $annoFeat.keys.length === 0}
        on:click={() => ($annoFeat.selecting = !$annoFeat.selecting)}
      >
        {#if $annoFeat.selecting}
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
          'button my-0 h-full w-min bg-neutral-600 py-1 px-2 duration-75 hover:bg-neutral-500',
          disabled
        )}
        disabled={$annoFeat.keys.length === 0}
        use:tooltip={{ content: 'Export annotated points as CSV' }}
        on:click={() =>
          toCSV(
            `annotations_${$sSample.name}.csv`,
            $sMapp.persistentLayers.annotations.points.dump()
          )}
      >
        <Icon src={ArrowUpOnSquare} class="svg-icon" />
      </button>
    </div>

    <div class="flex-grow" />
  </div>

  <div class="ml-4 flex items-center gap-x-3">
    {#each $annoFeat.keys as key, i}
      <label class="flex items-center gap-x-1 hover:underline">
        <div class="h-3 w-3" style={`background-color: ${schemeTableau10[i % 10]}`} />
        <button
          class={classes($annoFeat.currKey === i ? 'font-bold' : 'font-normal text-neutral-300')}
          on:click={() => ($annoFeat.currKey = i)}
        >
          {key}
        </button>
        {nPoints[key] ?? 0}
      </label>
    {/each}
  </div>

  <!-- Status text -->
  <div class="mt-2">
    {!$annoFeat.annotatingCoordName
      ? 'Not annotating.'
      : $annoFeat.keys.length === 0
      ? 'Add labels to start annoFeat.'
      : $annoFeat.selecting
      ? `Selecting ${$annoFeat.annotatingCoordName}.`
      : `Click on points to annotate ${$annoFeat.annotatingCoordName}.`}
  </div>
  <div class="flex">
    <div>{nPoints._total} points annotated.</div>
    <div class="flex-grow" />
    <div class="flex items-center gap-x-2">
      <label>
        <input class="translate-y-0.5" type="checkbox" bind:checked={$annoFeat.show} />
        Show overlay
      </label>
    </div>
  </div>
  <!-- <div class="mx-auto mt-1 h-[1px] w-1/2 bg-neutral-700" /> -->
  <!-- Selections -->
  {#if $annoFeat.annotatingCoordName && $annoFeat.keys.length > 0}
    <!-- <SelectionBox
      names={selectionNames}
      on:hover={(evt) => map.draw?.highlightPolygon(evt.detail.i)}
      on:delete={(evt) => map.draw?.deletePolygon(evt.detail.i)}
      on:clearall={() => map.draw?.clear()}
      on:export={(evt) => handleExport(evt.detail.name)}
      on:import={(evt) => fromJSON(evt.detail.e).catch(console.error)}
    />
  </div> -->
  {/if}
</section>
