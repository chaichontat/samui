<script lang="ts">
  import { annotating, sMapp, sSample } from '$lib/store';
  import type { Draww } from '$lib/ui/overlays/selector';
  import { tooltip } from '$lib/ui/utils';
  import { schemeTableau10 } from 'd3';
  import { onMount } from 'svelte';
  import Plus from '../components/plus.svelte';
  import { getFileFromEvent, toCSV, toJSON } from '../io';
  import { classes } from '../utils';

  export let toggled: boolean;

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
    map.draw!.draw.on('drawend', () => ($annotating.selecting = false));
    draw = map.draw;
  });

  // Enable/disable polygon draw
  $: if (map.map && map.draw) {
    if ($annotating.selecting) {
      if ($annotating.currKey == undefined) {
        alert('Set annotation name first');
        $annotating.selecting = false;
      } else {
        map.map?.addInteraction(map.draw.draw);
        map.map.getViewport().style.cursor = 'crosshair';
      }
    } else {
      map.map.removeInteraction(map.draw.draw);
      map.map.getViewport().style.cursor = 'grab';
    }
  }

  $: $annotating.selecting = toggled;

  const disabled =
    'disabled:cursor-auto disabled:bg-slate-500 hover:disabled:bg-slate-500 disabled:text-slate-300';
</script>

<section class="flex flex-col gap-y-3">
  <!-- Labels -->
  <div class="flex">
    <button
      class={classes(
        'mr-4 flex items-center gap-x-0.5 rounded-lg bg-blue-700 py-1 pl-2 pr-3 font-medium transition-colors hover:bg-blue-600',
        disabled
      )}
      on:click={() => ($annotating.currKey = handleNewKey(prompt('Enter new key.')))}
      disabled={$annotating.selecting}
    >
      <Plus class="h-4 w-4 translate-y-[1px] stroke-current stroke-[2.5]" />
      Label
    </button>

    <div class="flex flex-wrap items-center gap-x-3">
      {#each $annotating.keys as key, i}
        <label class="flex items-center gap-x-1 hover:underline">
          <div class="h-3 w-3" style={`background-color: ${schemeTableau10[i % 10]}`} />
          <button
            class={classes($annotating.currKey === i ? 'font-bold' : 'font-normal text-slate-300')}
            on:click={() => ($annotating.currKey = i)}>{key}</button
          >
        </label>
      {/each}
    </div>
  </div>

  <!-- <div class="mx-auto mt-1 h-[1px] w-1/2 bg-slate-700" /> -->
  <!-- Selections -->
  {#if $annotating.currKey != undefined}
    <div class="flex items-center gap-x-2">
      <button
        class={classes(
          'mr-4 flex items-center gap-x-0.5 rounded-lg bg-emerald-700 py-1 pl-2 pr-3 font-medium transition-colors hover:bg-emerald-600',
          disabled
        )}
        on:click={() => ($annotating.selecting = true)}
        disabled={$annotating.selecting}
      >
        <Plus class="h-4 w-4 translate-y-[1px] stroke-current stroke-[2.5]" />
        Selections
      </button>
    </div>

    <!-- <SelectionBox
      names={selectionNames}
      on:hover={(evt) => map.draw?.highlightPolygon(evt.detail.i)}
      on:delete={(evt) => map.draw?.deletePolygon(evt.detail.i)}
      on:clearall={() => map.draw?.clear()}
      on:export={(evt) => handleExport(evt.detail.name)}
      on:import={(evt) => fromJSON(evt.detail.e).catch(console.error)}
    />
  </div> -->
    <div class="mx-auto my-3 h-[1px] w-1/2 bg-slate-700" />
    <label>
      <input type="checkbox" bind:checked={$annotating.show} />
      Show overlay
    </label>

    <button
      class={classes('button my-0 w-min flex-grow py-1.5 transition-colors duration-75', disabled)}
      disabled={!$annotating.currKey}
      use:tooltip={{ content: 'Export annotated overlay as CSV' }}
      on:click={() =>
        toCSV(`annotations_${$sSample.name}.csv`, $sMapp.persistentLayers.annotations.dump())}
      ><svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg></button
    >
  {/if}
</section>
