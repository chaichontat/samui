<script lang="ts">
  import Colorbar from '$src/lib/components/colorbar.svelte';
  import type { Mapp } from '$src/lib/mapp/mapp';
  import SelectionBox from '$src/lib/mapp/selectionBox.svelte';
  import { oneLRU } from '$src/lib/utils';
  import { onMount } from 'svelte';
  import type { PlainJSON } from '../data/features';
  import { activeFeatures, activeSample, samples } from '../store';
  import type { Draww } from './selector';

  export let map: Mapp;
  export let selecting: boolean;
  export let showImgControl: boolean;
  export let colorbar = true;
  export let width = 0;
  let draw: Draww | undefined;

  onMount(async () => {
    await map.promise;
    map.draw!.draw.on('drawend', () => (selecting = false));
    map.draw!.source.on('addfeature', (evt) => {
      if (!evt.feature!.get('name')) {
        const name = prompt('Name of selection');
        map.draw!.setPolygonName(-1, name ?? 'Selection');
      }
      updateSelection();
    });
    draw = map.draw;
  });

  let selectionNames: string[] = [];
  function updateSelectionNames() {
    selectionNames = map.draw?.getPolygonsName() ?? [];
  }
  function updateSelectionPoints() {
    if (!map.mounted) return;
    const names = map.draw?.getPolygonsName() ?? [];
    const arr = ($samples[$activeSample].features._selections as PlainJSON).values as string[];
    arr.fill('');
    for (const [i, n] of names.entries()) {
      map.draw!.getPoints(i).forEach((p) => (arr[p] = n));
    }
  }

  function updateSelection() {
    updateSelectionNames();
    updateSelectionPoints();
  }

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
    if (!map.mounted) return;
    switch (t) {
      case 'selections':
        toJSON(
          draw!.dumpPolygons(),
          `selections_${$activeSample}.json`,
          'selections',
          $activeSample
        );
        break;
      case 'spots':
        toJSON(draw!.dumpAllPoints(), `spots_${$activeSample}.json`, 'spots', $activeSample);
        break;
      default:
        throw new Error('Unknown export type');
    }
  }

  function toJSON(t: object, name: string, type: string, sample: string) {
    const blob = new Blob([JSON.stringify({ sample, type, values: t })], {
      type: 'application/json'
    });
    const elem = window.document.createElement('a');
    elem.href = window.URL.createObjectURL(blob);
    elem.download = name;
    document.body.appendChild(elem);
    elem.click();
    document.body.removeChild(elem);
  }

  async function fromJSON(e: { currentTarget: EventTarget & HTMLInputElement }) {
    if (!e.currentTarget.files) return;
    const raw = await e.currentTarget.files[0].text();

    try {
      const parsed = JSON.parse(raw) as {
        sample: string;
        type: string;
        values: ReturnType<Draww['dumpPolygons']>;
      };
      if (parsed.type !== 'selections') {
        alert('Not a polygon. Make sure that you have the correct file.');
      }
      if (parsed.sample !== $activeSample) {
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
        on:delete={(evt) => {
          map.draw?.deletePolygon(evt.detail.i);
          updateSelection();
        }}
        on:clearall={() => {
          map.draw?.clear();
          updateSelection();
        }}
        on:export={(evt) => handleExport(evt.detail.name)}
        on:import={(evt) => fromJSON(evt.detail.e).catch(console.error)}
        on:rename={(evt) => {
          const newName = prompt('Enter new selection name.');
          if (newName) {
            draw?.setPolygonName(evt.detail.i, newName);
            updateSelection();
          }
        }}
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

  <!-- Spots -->
  {#if showImgControl}
    <div
      class="inline-flex flex-col gap-y-1 rounded-lg bg-slate-100/80 p-2 px-3 text-sm font-medium backdrop-blur transition-all hover:bg-slate-200 dark:bg-neutral-600/90 dark:text-white/90 dark:hover:bg-neutral-600"
    >
      <table>
        {#each Object.keys($samples[$activeSample].overlays) as ovName}
          <tr class="flex">
            <td class="flex gap-x-1 pr-2">
              <label class="flex cursor-pointer items-center gap-x-1">
                <input
                  type="checkbox"
                  class="mr-0.5 cursor-pointer bg-opacity-80"
                  checked
                  on:change={(e) =>
                    map.layers[ovName]?.outline?.layer.setVisible(e.currentTarget.checked ?? false)}
                />
              </label>
              <label class="flex cursor-pointer items-center gap-x-1">
                <input
                  type="checkbox"
                  class="mr-0.5 cursor-pointer bg-opacity-80"
                  checked
                  on:change={(e) => setVisible(ovName, e.currentTarget.checked ?? false)}
                />
                <span class="max-w-[10rem] select-none text-ellipsis capitalize">{ovName}</span>
              </label>
            </td>

            <td class="pr-3 text-yellow-400">
              {$activeFeatures[ovName]?.name ?? 'None'}
            </td>

            <td>
              <input
                type="range"
                min="0"
                max="1"
                value="0.9"
                step="0.01"
                on:change={(e) => setOpacity(ovName, e.currentTarget.value)}
                on:mousemove={(e) => setOpacity(ovName, e.currentTarget.value)}
                class="max-w-[5rem] translate-y-[2px] cursor-pointer opacity-80"
              />
            </td>
          </tr>
        {/each}
      </table>
    </div>
  {/if}
</section>

{#if colorbar}
  <div class="absolute right-4 bottom-4 z-20 items-end">
    <Colorbar bind:opacity={colorOpacity} title="Log" color="turbo" min={0} max={10} />
  </div>
{/if}
