<script lang="ts">
  import { getFileFromEvent, toCSV, toJSON } from '$lib/io';
  import { annoROI, sEvent, sMapp, sSample } from '$lib/store';
  import { tooltip } from '$lib/ui/utils';
  import { classes } from '$lib/utils';
  import Checkbox from '$src/lib/components/Checkbox.svelte';
  import type { Draww } from '$src/lib/sidebar/annotation/selector';
  import type { Mapp } from '$src/lib/ui/mapp';
  import { ArrowUpOnSquare, Plus, PlusCircle, PlusSmall, XMark } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { schemeTableau10 } from 'd3';
  import { onMount } from 'svelte';
  import AnnoButton from './annoButton.svelte';

  export let toggled = true;
  let nPoints: Record<string, number> = { _total: 0 };

  $: if ($sEvent?.type === 'sampleUpdated') {
    $sMapp.persistentLayers.rois.clear();
  }

  function handleNewKey(name: string | null) {
    if (name == null) {
      alert('Empty name.');
      return;
    }
    const newKey = name.trim();

    if ($annoROI.keys.findIndex((v) => v === newKey) === -1) {
      $annoROI.keys.push(newKey);
      $annoROI.keys = $annoROI.keys;
      return $annoROI.keys.length - 1;
    }
    alert('Key already exists.');
    return $annoROI.currKey;
  }

  let draw: Draww | undefined;
  let map: Mapp;
  $: map = $sMapp;
  $: sample = $sSample;

  onMount(async () => {
    await map.promise;
    map.persistentLayers.rois.draw.on('drawend', () => ($annoROI.selecting = undefined));
    draw = map.persistentLayers.rois;
  });

  // Enable/disable polygon draw
  $: if (map.map) {
    if ($annoROI.selecting) {
      map.map?.addInteraction(map.persistentLayers.rois.draw);
      map.map.getViewport().style.cursor = 'crosshair';
    } else {
      map.map.removeInteraction(map.persistentLayers.rois.draw);
      map.map.getViewport().style.cursor = 'default';
    }
  }

  $: if (['pointsAdded', 'sampleUpdated'].includes($sEvent?.type)) {
    nPoints = map.persistentLayers.rois.getComposition();
    console.log(nPoints);
  }
</script>

<section class="flex flex-col gap-y-1">
  <div class="flex items-center">
    <AnnoButton
      class="bg-green-800 shadow-green-800/20 hover:bg-green-700"
      onClick={() => ($annoROI.currKey = handleNewKey(prompt('Enter new key.')))}
    >
      <Icon src={Plus} class="mr-0.5 h-3 w-3 translate-y-[1px] stroke-current stroke-[2.5]" />
      Label
    </AnnoButton>

    <div class="ml-4 flex items-center gap-x-3">
      {#each $annoROI.keys as key, i}
        <label class="flex items-center gap-x-1 hover:underline">
          <div class="h-3 w-3" style={`background-color: ${schemeTableau10[i % 10]}`} />
          <button
            class={classes($annoROI.currKey === i ? 'font-bold' : 'font-normal text-neutral-300')}
            on:click={() => ($annoROI.currKey = i)}
            on:dblclick={() => {
              const oldName = key;
              const newName = prompt('Enter new name.', key);
              if (newName == null) return;
              $annoROI.keys[i] = newName;
              map.persistentLayers.rois.updateName(oldName, newName);
            }}
          >
            {key}
          </button>
          {nPoints[key] ?? 0}
          <button
            on:click={() => {
              if (!confirm(`Delete key "${key}"?`)) return;
              $annoROI.keys.splice(i, 1);
              if ($annoROI.currKey === $annoROI.keys.length) $annoROI.currKey = 0;
              $annoROI.keys = $annoROI.keys;
              map.persistentLayers.rois.removeFeaturesByName(key);
            }}
          >
            <Icon src={XMark} class="svg-icon stroke-neutral-400 hover:stroke-white" />
          </button>
        </label>
      {/each}
    </div>
  </div>

  <!-- Select -->
  <div class="flex flex-wrap items-center gap-1">
    <AnnoButton
      class={'bg-sky-800  shadow-sky-800/20 hover:bg-sky-700'}
      ping={$annoROI.selecting === 'Polygon'}
      disabled={($annoROI.selecting !== undefined && $annoROI.selecting !== 'Polygon') ||
        $annoROI.keys.length === 0}
      onClick={() => {
        $sMapp.persistentLayers.rois.changeDrawType('Polygon');
        $annoROI.selecting = $annoROI.selecting ? undefined : 'Polygon';
      }}
    >
      <Icon src={Plus} class="-ml-1 mr-0.5 h-3 w-3 translate-y-[1px] stroke-current stroke-[2.5]" />
      Polygon
    </AnnoButton>

    <AnnoButton
      class={'bg-sky-800  shadow-sky-800/20 hover:bg-sky-700'}
      ping={$annoROI.selecting === 'Circle'}
      disabled={($annoROI.selecting !== undefined && $annoROI.selecting !== 'Circle') ||
        $annoROI.keys.length === 0}
      onClick={() => {
        $sMapp.persistentLayers.rois.changeDrawType('Circle');
        $annoROI.selecting = $annoROI.selecting ? undefined : 'Circle';
      }}
    >
      <Icon
        src={PlusCircle}
        class="-ml-1 mr-0.5 h-3 w-3 translate-y-[1px] stroke-current stroke-[2.5]"
      />
      Circle
    </AnnoButton>

    <AnnoButton
      class={'bg-sky-800  shadow-sky-800/20 hover:bg-sky-700'}
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
        class="-ml-1 mr-0.5 h-3 w-3 translate-y-[1px] stroke-current stroke-[2.5]"
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
          rois: $sMapp.persistentLayers.rois.dump(),
          mPerPx: $sSample.imgParams?.mPerPx,
          sample: $sSample.name,
          time: new Date().toISOString()
        });
      }}
      disabled={$annoROI.keys.length === 0}
    >
      <Icon src={ArrowUpOnSquare} class="svg-icon" />
    </button>
    <!-- <Checkbox bind:checked={$annoROI.nameSeparately}>Name Separately (for ROIs only)</Checkbox> -->
  </div>

  <div class="flex-grow" />
</section>
