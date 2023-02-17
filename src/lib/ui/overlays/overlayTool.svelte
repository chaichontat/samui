<script lang="ts">
  import { oneLRU } from '$lib/lru';
  import { annoFeat, overlays, overlaysFeature, sEvent, sOverlay, sSample } from '$lib/store';
  import type { Sample } from '$src/lib/data/objects/sample';
  import { classes } from '$src/lib/utils';
  import { ArrowLongRight, Plus, XMark } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';
  import type { Mapp } from '../mapp';
  import { tooltip } from '../utils';
  import { WebGLSpots } from './points';

  let sample: Sample;
  $: sample = $sSample;
  export let map: Mapp;

  const setOpacity = oneLRU((name: string, opacity: string) => {
    $overlays[name]?.layer?.updateStyleVariables({
      opacity: Number(opacity)
    });
  });

  const outlinevis: Record<string, boolean> = {};
  const visible: Record<string, boolean> = {};
  const setVisible = (name: string, c: boolean | null, outline = false) => {
    if (outline) {
      const layer = $overlays[name]?.outline;
      if (layer) layer.visible = c ?? false;
      outlinevis[name] = c ?? false;
    } else {
      const layer = $overlays[name];
      if (layer) layer.visible = c ?? false;
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

<table class="min-w-[250px] table-fixed">
  {#if sample}
    {#each Object.entries($overlays) as [uid, ov], i}
      {@const fg = $overlaysFeature[uid]}
      <tr class:opacity-70={$sOverlay !== ov.uid}>
        <td>
          <Icon
            src={ArrowLongRight}
            class={classes('svg-icon mr-1', $sOverlay === ov.uid ? '' : 'invisible')}
          />
        </td>
        <td class="flex items-center">
          <!-- Outline checkbox -->
          <input
            type="checkbox"
            class="mr-1 cursor-pointer"
            use:tooltip={{ content: 'Border. Disabled for samples with >100,000 points.' }}
            on:change={(e) => setVisible(uid, e.currentTarget.checked, true)}
          />

          <!-- Fill checkbox -->
          <input
            type="checkbox"
            class="cursor-pointer"
            checked
            use:tooltip={{ content: 'Fill' }}
            on:change={(e) => setVisible(uid, e.currentTarget.checked)}
          />
          &nbsp;
        </td>
        <!-- Overlay name -->
        <td>
          <span
            on:click={() => ($sOverlay = uid)}
            class={classes(
              'mr-2 max-w-[10rem] cursor-pointer select-none overflow-auto text-ellipsis whitespace-nowrap capitalize',
              uid === $annoFeat.annotating?.overlay ? 'text-teal-400' : 'text-white'
            )}
          >
            {ov.uid
              ? fg
                ? `${uid === $annoFeat.annotating?.overlay ? 'Anno: ' : ''}${fg?.group} > ${
                    fg?.feature
                  }`
                : 'None'
              : ''}
          </span>

          <select
            class="cursor-pointer form-select appearance-none w-full px-3 py-1 text-sm font-normal text-gray-700 bg-gray-800 bg-clip-padding bg-no-repeat border border-solid border-gray-600 rounded transition ease-in-out"
          >
            <option value="Turbo">Turbo</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </td>
        <td class="w-full" />
        <!-- Opacity bar -->
        <td>
          <input
            class="max-w-[5rem] -translate-y-0.5 cursor-pointer align-middle opacity-80"
            type="range"
            min="0"
            max="1"
            value="0.8"
            step="0.01"
            on:change={(e) => setOpacity(uid, e.currentTarget.value)}
            on:mousemove={(e) => setOpacity(uid, e.currentTarget.value)}
            use:tooltip={{ content: 'Opacity' }}
          />
        </td>
        <td class="h-4 w-4">
          {#if i !== 0}
            <button
              class="flex cursor-pointer items-center pl-1 opacity-80 transition-opacity hover:opacity-100"
              on:click={() => {
                if ($annoFeat.annotating?.overlay === ov.uid) {
                  alert('You cannot delete the layer you are annotating.');
                  return;
                }
                $overlays[uid].dispose();
                delete $overlays[uid];
                $sOverlay = $sOverlay === uid ? Object.keys($overlays)[0] : $sOverlay;
                $overlays = $overlays;
                sEvent.set({ type: 'featureUpdated' });
              }}
            >
              <Icon src={XMark} class="svg-icon" />
            </button>
          {/if}
        </td>
      </tr>
    {/each}
  {/if}
</table>

<div class="flex w-full justify-center border-t border-t-white/30">
  <!-- <FileInput accept=".csv" on:import={addOverlay}> -->
  <div
    class="mt-1.5 flex cursor-pointer items-center transition-opacity hover:font-semibold hover:text-white"
    on:click={addOverlay}
  >
    <Icon src={Plus} class="svg-icon mr-1 h-[14px] w-[14px] translate-y-[1px] stroke-[2.5]" />
    <div class="font-normal">Add Layer</div>
  </div>
  <!-- </FileInput> -->
</div>

<!-- use:tooltip={{
        content: 'CSV file with columns: `x`, `y` in pixels, and optional `id`.'
      }} -->
