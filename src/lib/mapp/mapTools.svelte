<script lang="ts">
  import { classes, tooltip } from '$lib/utils';
  import Colorbar from '$src/lib/components/colorbar.svelte';
  import type { Mapp } from '$src/lib/mapp/mapp';
  import SelectionBox from '$src/lib/mapp/selectionBox.svelte';
  import { oneLRU } from '$src/lib/utils';
  import { onMount } from 'svelte';
  import type { Sample } from '../data/sample';
  import { getFileInput, toJSON } from '../io';
  import { annotating, samples, sFeature, sOverlay } from '../store';
  import type { Draww } from './selector';

  export let sample: Sample | undefined;
  export let map: Mapp;
  export let showImgControl: boolean;
  export let colorbar = true;
  export let width = 0;
  let draw: Draww | undefined;
  let selecting = false;

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
  let colorOpacity = 1;

  const setVisible = (name: string, c: boolean | null) =>
    map.layers[name]?.layer?.setVisible(c ?? false);

  const setOpacity = oneLRU(async (name: string, opacity: string) => {
    await map.layers[name]?.promise;
    colorOpacity = Number(opacity);
    map.layers[name]?.layer!.updateStyleVariables({ opacity: Number(opacity) });
  });

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
    const raw = await getFileInput(e.currentTarget);
    try {
      const parsed = JSON.parse(raw) as {
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

<section
  class="absolute right-4 top-4 z-20 flex flex-col items-end gap-3"
  class:top-16={width < 500 && showImgControl}
>
  <div class="flex space-x-2">
    <!-- Show/hide -->
    <button
      class="z-20 h-9"
      class:pr-2={showImgControl}
      on:click={() => (showImgControl = !showImgControl)}
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="svg-icon h-6 w-6" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </button>

    <!-- Select button -->
    {#if showImgControl}
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
    {/if}
  </div>

  <!-- Overlay selector -->
  {#if showImgControl}
    <div
      class="inline-flex flex-col gap-y-1 rounded-lg bg-slate-100/80 p-2 px-3 text-sm font-medium backdrop-blur transition-all hover:bg-slate-200 dark:bg-neutral-600/90 dark:text-white/90 dark:hover:bg-neutral-600"
    >
      <table class="table-fixed">
        {#if sample}
          {#each Object.keys($samples[sample.name].overlays) as ovName}
            <tr>
              <td class="flex gap-x-1 pr-2">
                <!-- Outline checkbox -->
                <input
                  type="checkbox"
                  class="mr-0.5 cursor-pointer items-center gap-x-1 bg-opacity-80"
                  use:tooltip={{ content: 'Border' }}
                  checked
                  on:change={(e) =>
                    map.layers[ovName]?.outline?.layer?.setVisible(
                      e.currentTarget.checked ?? false
                    )}
                />

                <!-- Fill checkbox -->
                <input
                  type="checkbox"
                  class="mr-0.5 cursor-pointer items-center gap-x-1 bg-opacity-80"
                  checked
                  use:tooltip={{ content: 'Fill' }}
                  on:change={(e) => setVisible(ovName, e.currentTarget.checked ?? false)}
                />

                <!-- Overlay name -->
                <span
                  on:click={() => ($sOverlay = ovName)}
                  class={classes(
                    'max-w-[10rem] cursor-pointer select-none text-ellipsis capitalize',
                    $sOverlay === ovName ? 'text-white' : 'text-white/70'
                  )}>{ovName}</span
                >
              </td>

              <!-- Feature name -->
              <td
                on:click={() => ($sOverlay = ovName)}
                class={classes(
                  'min-w-[4rem] cursor-pointer pr-3',
                  $sOverlay === ovName ? 'text-yellow-300' : 'text-yellow-300/70'
                )}
              >
                {$sFeature[ovName]?.feature ?? 'None'}
              </td>

              <!-- Opacity bar -->
              <td>
                <input
                  type="range"
                  min="0"
                  max="1"
                  value="0.9"
                  step="0.01"
                  on:change={(e) => setOpacity(ovName, e.currentTarget.value)}
                  on:mousemove={(e) => setOpacity(ovName, e.currentTarget.value)}
                  use:tooltip={{ content: 'Opacity' }}
                  class="max-w-[5rem] translate-y-[2px] cursor-pointer opacity-80"
                />
              </td>
            </tr>
          {/each}
        {/if}
      </table>
    </div>
  {/if}
</section>

{#if colorbar}
  <div class="absolute right-4 bottom-4 z-20 items-end">
    <Colorbar bind:opacity={colorOpacity} title="Log" color="turbo" min={0} max={10} />
  </div>
{/if}
