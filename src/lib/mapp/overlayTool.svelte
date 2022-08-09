<script lang="ts">
  import { classes, tooltip } from '$lib/utils';
  import type { Mapp } from '$src/lib/mapp/mapp';
  import { oneLRU } from '$src/lib/utils';
  import FileInput from '../components/fileInput.svelte';
  import type { Coord } from '../data/features';
  import { OverlayData, type OverlayParams } from '../data/overlay';
  import type { Sample } from '../data/sample';
  import { fromCSV, getFileFromEvent } from '../io';
  import { sFeature, sOverlay, sSample } from '../store';

  export let sample: Sample;
  export let map: Mapp;

  const setOpacity = oneLRU(async (name: string, opacity: string) => {
    await map.layers[name]?.promise;
    map.layers[name]?.layer!.updateStyleVariables({ opacity: Number(opacity) });
  });

  const setVisible = (name: string, c: boolean | null) =>
    map.layers[name]?.layer?.setVisible(c ?? false);

  async function addOverlay(ev: CustomEvent<{ e: EventTarget & HTMLInputElement }>) {
    const name = prompt('Overlay name?');
    if (!name) {
      alert('Name cannot be empty.');
      return;
    }

    if (name in $sSample.overlays) {
      alert('Name cannot be the same as existing overlay.');
      return;
    }

    const raw = await getFileFromEvent(ev.detail.e);
    const pos = await fromCSV(raw);
    if (!pos || pos.errors.length) {
      alert(pos?.errors.join(', '));
      return;
    }

    for (const p of pos.data) {
      if (!('x' in p) || !('y' in p)) {
        alert('x or y not in every line.');
        return;
      }
    }

    const op: OverlayParams = {
      name,
      shape: 'circle',
      pos: pos.data as Coord[],
      mPerPx: $sSample.image.mPerPx
    };

    sample!.overlays[name] = new OverlayData(op);
    await map.update({ overlays: sample!.overlays, refresh: true });
  }
</script>

<div
  class="inline-flex flex-col gap-y-1 rounded-lg bg-slate-100/80 p-2 px-3 text-sm font-medium backdrop-blur dark:bg-neutral-600/90 dark:text-white/90"
>
  <table class="table-fixed">
    {#if sample}
      {#each Object.keys(sample.overlays) as ovName}
        <tr>
          <td class="flex gap-x-1 pr-2">
            <!-- Outline checkbox -->
            <input
              type="checkbox"
              class="mr-0.5 cursor-pointer items-center gap-x-1 bg-opacity-80"
              use:tooltip={{ content: 'Border' }}
              checked
              on:change={(e) =>
                map.layers[ovName]?.outline?.layer?.setVisible(e.currentTarget.checked ?? false)}
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

  <!-- Upload -->
  <div class="flex w-full justify-center border-t border-t-white/30">
    <FileInput accept=".csv" on:import={addOverlay}>
      <div
        class="mt-1.5 flex cursor-pointer items-center opacity-90 transition-opacity hover:opacity-100"
        use:tooltip={{
          content: 'CSV file with columns: `x`, `y` in pixels, and optional `id`.'
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="mr-0.5 h-4 w-4 stroke-slate-300 stroke-[2]"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        <div class="font-normal">Add Overlay</div>
      </div>
    </FileInput>
  </div>
</div>
