<script lang="ts">
  import { annotating, sMapp, sSample } from '$lib/store';
  import SelectionBox from '$src/lib/mapp/selectionBox.svelte';
  import { schemeTableau10 } from 'd3';
  import { onMount } from 'svelte';
  import { getFileFromEvent, toCSV, toJSON } from '../io';
  import type { Draww } from './selector';

  function handleNewKey(name: string | null) {
    if (name === null) {
      alert('Empty name.');
      return;
    }
    const newKey = name.trim();

    if ($annotating.keys.findIndex((v) => v === newKey) === -1) {
      $annotating.keys.push(newKey);
      $annotating.keys = $annotating.keys;
      $annotating.currKey = $annotating.keys.length - 1;
    } else {
      alert('Key already exists.');
    }
  }

  let draw: Draww | undefined;
  let selecting = false;

  $: map = $sMapp;
  $: sample = $sSample;

  onMount(async () => {
    await map.promise;
    map.draw!.draw.on('drawend', () => (selecting = false));
    draw = map.draw;
  });

  // Enable/disable polygon draw
  $: if (map.map && map.draw) {
    if (selecting) {
      if ($annotating.currKey === null) {
        alert('Set annotation name first');
        selecting = false;
      } else {
        map.map?.addInteraction(map.draw.draw);
        map.map.getViewport().style.cursor = 'crosshair';
      }
    } else {
      map.map.removeInteraction(map.draw.draw);
      map.map.getViewport().style.cursor = 'grab';
    }
  }

  let selectionNames: string[] = [];

  // TODO: Use makedownload.
  function handleExport(t: 'spots' | 'selections') {
    if (!map.mounted || !sample) return;
    switch (t) {
      case 'selections':
        toJSON(`selections_${sample.name}.json`, {
          sample: sample.name,
          type: 'selections',
          values: draw!.dumpPolygons()
        });
        break;
      case 'spots':
        toJSON(`spots_${sample.name}.json`, {
          sample: sample.name,
          type: 'spots',
          values: draw!.dumpAllPoints()
        });
        break;
      default:
        throw new Error('Unknown export type');
    }
  }

  async function fromJSON(e: { currentTarget: EventTarget & HTMLInputElement }) {
    const raw = await getFileFromEvent(e);
    try {
      const parsed = JSON.parse(raw!) as {
        sample: string;
        type: string;
        values: ReturnType<Draww['dumpPolygons']>;
      };
      if (parsed.type !== 'selections') {
        alert('Not a polygon. Make sure that you have the correct file.');
      }
      if (parsed.sample !== sample?.name) {
        alert('Sample does not match.');
      }

      draw!.loadPolygons(parsed.values);
    } catch (e) {
      alert(e);
    }
  }
</script>

<section class="flex flex-col gap-y-2">
  <div class="flex gap-x-6">
    {#each $annotating.keys as key, i}
      <label class="flex items-center gap-x-1 hover:underline">
        <div class="h-3 w-3" style={`background-color: ${schemeTableau10[i % 10]}`} />
        <button
          on:click={() => ($annotating.currKey = i)}
          class:font-bold={$annotating.currKey === i}>{key}</button
        >
      </label>
    {/each}
  </div>

  <label>
    <input type="checkbox" bind:checked={$annotating.show} />
    Show overlay
  </label>

  <button
    class="button my-0 flex-grow py-2 transition-colors duration-75 dark:bg-slate-800 hover:dark:bg-slate-500"
    on:click={() => handleNewKey(prompt('Enter new key.'))}>Add</button
  >

  <button
    class="button my-0 flex-grow py-2 transition-colors duration-75 dark:bg-slate-800 hover:dark:bg-slate-500"
    on:click={() => {
      if ($annotating.currKey !== null) {
        toCSV(`annotations_${$sSample.name}.csv`, $sMapp.persistentLayers.annotations.dump());
      }
    }}>Download</button
  >

  <div class="flex space-x-2">
    <!-- Select button -->

    <SelectionBox
      names={selectionNames}
      on:hover={(evt) => map.draw?.highlightPolygon(evt.detail.i)}
      on:delete={(evt) => map.draw?.deletePolygon(evt.detail.i)}
      on:clearall={() => map.draw?.clear()}
      on:export={(evt) => handleExport(evt.detail.name)}
      on:import={(evt) => fromJSON(evt.detail.e).catch(console.error)}
    />
    <button
      class="rounded-lg bg-sky-600/80 px-2 py-1 text-sm text-white shadow backdrop-blur transition-all hover:bg-sky-600/80 active:bg-sky-500/80 dark:bg-sky-600/90 dark:text-slate-200 dark:hover:bg-sky-600"
      class:bg-slate-600={selecting}
      class:hover:bg-slate-600={selecting}
      class:active:bg-slate-600={selecting}
      class:dark:bg-slate-600={selecting}
      class:dark:hover:bg-slate-600={selecting}
      class:dark:active:bg-slate-600={selecting}
      on:click={() => (selecting = true)}
      disabled={selecting}
      ><svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5 stroke-white stroke-[2.5]"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    </button>
  </div>
</section>
