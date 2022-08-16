<script lang="ts">
  import { annotating, sMapp, sSample } from '$lib/store';
  import SelectionBox from '$src/lib/mapp/selectionBox.svelte';
  import { schemeTableau10 } from 'd3';
  import { onMount } from 'svelte';
  import Plus from '../components/plus.svelte';
  import { getFileFromEvent, toCSV, toJSON } from '../io';
  import { classes, tooltip } from '../utils';
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
      if ($annotating.currKey === null) {
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

<section class="flex flex-col gap-y-3">
  <!-- Labels -->
  <div>
    <div class="flex items-center gap-x-2">
      Labels
      <button
        class="py-1 text-sm text-white"
        on:click={() => handleNewKey(prompt('Enter new key.'))}
        disabled={$annotating.selecting}
      >
        <Plus class="h-5 w-5 stroke-current stroke-[2.5]" />
      </button>
    </div>

    <div class="mt-1 ml-2 flex flex-wrap items-center gap-x-6 text-sm">
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
  <div class="mx-auto mt-1 h-[1px] w-1/2 bg-slate-700" />
  <!-- Selections -->
  <div>
    <div class="flex items-center gap-x-2">
      Selections
      <button
        class="py-1 text-sm text-white"
        on:click={() => ($annotating.selecting = true)}
        disabled={$annotating.selecting}
      >
        <Plus class="h-5 w-5 stroke-current stroke-[2.5]" />
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
      use:tooltip={{ content: 'Export annotated overlay as CSV' }}
      class="button my-0 flex-grow py-2 transition-colors duration-75 dark:bg-slate-800 hover:dark:bg-slate-500"
      on:click={() => {
        if ($annotating.currKey !== null) {
          toCSV(`annotations_${$sSample.name}.csv`, $sMapp.persistentLayers.annotations.dump());
        }
      }}
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
  </div>
</section>
