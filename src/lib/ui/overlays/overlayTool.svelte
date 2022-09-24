<script lang="ts">
  import { oneLRU } from '$lib/lru';
  import { overlays, sFeature, sOverlay, sSample } from '$lib/store';
  import type { Sample } from '$src/lib/data/objects/sample';
  import { classes } from '$src/lib/utils';
  import type { Mapp } from '../mapp';
  import { tooltip } from '../utils';
  import { WebGLSpots } from './points';

  let sample: Sample;
  $: sample = $sSample;
  export let map: Mapp;

  const setOpacity = oneLRU(async (name: string, opacity: string) => {
    await $overlays[name].promise;
    $overlays[name]?.layer!.updateStyleVariables({ opacity: Number(opacity) });
  });

  const outlinevis: Record<string, boolean> = {};
  const visible: Record<string, boolean> = {};
  const setVisible = (name: string, c: boolean | null, outline = false) => {
    if (outline) {
      $overlays[name]?.outline?.layer?.setVisible(c ?? false);
      outlinevis[name] = c ?? false;
    } else {
      $overlays[name]?.layer?.setVisible(c ?? false);
      visible[name] = c ?? false;
    }
  };

  function addOverlay(ev: CustomEvent<{ e: EventTarget & HTMLInputElement }>) {
    const ol = new WebGLSpots(map);
    $overlays[ol.uid] = ol;
    $sOverlay = ol.uid;
  }
  //   const name = prompt('Overlay name?');
  //   if (!name) {
  //     alert('Name cannot be empty.');
  //     return;
  //   }

  //   if (name in $sSample.coords) {
  //     alert('Name cannot be the same as existing overlay.');
  //     return;
  //   }

  //   const raw = await getFileFromEvent(ev.detail.e);
  //   const pos = await fromCSV(raw);
  //   if (!pos || pos.errors.length) {
  //     alert(pos?.errors.join(', '));
  //     return;
  //   }

  //   for (const p of pos.data) {
  //     if (!('x' in p) || !('y' in p)) {
  //       alert('x or y not in every line.');
  //       return;
  //     }
  //   }

  //   const op: CoordsParams = {
  //     name,
  //     shape: 'circle',
  //     pos: pos.data as Coord[],
  //     mPerPx: sample.image?.mPerPx,
  //     addedOnline: true
  //   };

  //   sample!.coords[name] = new CoordsData(op);
  //   // await map.update({ overlays: sample!.overlays, refresh: true });
  //   $sSample = $sSample;
  //   for (const [name, v] of Object.entries(visible)) {
  //     setVisible(name, v);
  //   }
  //   for (const [name, v] of Object.entries(outlinevis)) {
  //     setVisible(name, v, true);
  //   }
  //   $sOverlay = name;
  // }
</script>

<div
  class="inline-flex flex-col gap-y-1 rounded-lg bg-slate-100/80 p-2 px-3 text-sm font-medium backdrop-blur dark:bg-neutral-600/90 dark:text-white/90"
>
  <table class="table-fixed">
    {#if sample}
      {#each Object.values($overlays) as ov}
        <tr>
          <td class="flex">
            <!-- Outline checkbox -->
            <input
              type="checkbox"
              class="mr-1 cursor-pointer"
              use:tooltip={{ content: 'Border' }}
              checked
              on:change={(e) => setVisible(ov.uid, e.currentTarget.checked, true)}
            />

            <!-- Fill checkbox -->
            <input
              type="checkbox"
              class="cursor-pointer"
              checked
              use:tooltip={{ content: 'Fill' }}
              on:change={(e) => setVisible(ov.uid, e.currentTarget.checked)}
            />
            &nbsp;
          </td>
          <!-- Overlay name -->
          <td>
            <span
              on:click={() => ($sOverlay = ov.uid)}
              class={classes(
                'mr-2 max-w-[10rem] cursor-pointer select-none text-ellipsis capitalize',
                $sOverlay === ov.uid ? 'text-white' : 'text-white/70'
              )}>{ov.uid ? $sFeature[ov.uid]?.feature ?? 'None' : ''}</span
            >
          </td>

          <!-- Feature name -->
          <td
            on:click={() => ($sOverlay = ov.uid)}
            class={classes(
              'min-w-[4rem] cursor-pointer pr-3',
              $sOverlay === ov.uid ? 'text-yellow-300' : 'text-yellow-300/70'
            )}
          >
            <!-- {$sFeature[ovName]?.feature ?? 'None'} -->
          </td>

          <!-- Opacity bar -->
          <td>
            <input
              class="max-w-[5rem] -translate-y-0.5 cursor-pointer align-middle opacity-80"
              type="range"
              min="0"
              max="1"
              value="0.9"
              step="0.01"
              on:change={(e) => setOpacity(ov.uid, e.currentTarget.value)}
              on:mousemove={(e) => setOpacity(ov.uid, e.currentTarget.value)}
              use:tooltip={{ content: 'Opacity' }}
            />
          </td>
          <!-- Delete -->
          <!-- {#if sample.overlays[ovName].addedOnline}
            <td class="">
              <button
                class="flex items-center pl-1 opacity-80 transition-opacity hover:opacity-100"
                on:click={async () => {
                  delete sample.overlays[ov.uid];
                  sample.overlays = sample.overlays;
                  await map.update({ overlays: sample.overlays, refresh: true });
                }}
                ><svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4 stroke-white stroke-2"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg></button
              >
            </td>
          {/if} -->
        </tr>
      {/each}
    {/if}
  </table>

  <!-- Upload -->
  <div class="flex w-full justify-center border-t border-t-white/30">
    <!-- <FileInput accept=".csv" on:import={addOverlay}> -->
    <div
      class="mt-1.5 flex cursor-pointer items-center opacity-90 transition-opacity hover:opacity-100"
      use:tooltip={{
        content: 'CSV file with columns: `x`, `y` in pixels, and optional `id`.'
      }}
      on:click={addOverlay}
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
    <!-- </FileInput> -->
  </div>
</div>
