<script lang="ts">
  import {
    annoFeat,
    overlays,
    overlaysFeature,
    sEvent,
    sMapp,
    sOverlay,
    sSample
  } from '$lib/store';

  import type { Sample } from '$src/lib/data/objects/sample';
  import { classes } from '$src/lib/utils';
  import { ArrowLongRight, Link, Plus, XMark } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { tooltip } from '../utils';
  import OverlayAdjust from './overlayAdjust.svelte';
  import { WebGLSpots, type StyleVars } from './points';

  let sample: Sample;
  $: sample = $sSample;

  let linkMinmax = false;

  const setStyleVars = (name: string, obj: { opacity?: string; max?: string; min?: string }) => {
    const numed: StyleVars = {};
    for (const [k, v] of Object.entries(obj)) {
      // @ts-ignore
      numed[k] = Number(v);
    }
    $overlays[name]?.updateStyleVariables(numed);
  };

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

  function addOverlay() {
    const ol = new WebGLSpots($sMapp);
    $overlays[ol.uid] = ol;
    $sOverlay = ol.uid;
  }
</script>

<table class="min-w-[250px] table-fixed" title="Overlay tools">
  {#if sample}
    <tbody>
      {#each Object.entries($overlays) as [uid, ov], i}
        {@const fg = $overlaysFeature[uid]}
        <tr data-testid={`overlay-row-${i}`}>
          <td>
            <Icon
              src={ArrowLongRight}
              class={classes('svg-icon mr-1', $sOverlay === ov.uid ? '' : 'invisible')}
            />
          </td>
          <td class="flex items-center" class:opacity-70={$sOverlay !== ov.uid}>
            <!-- Outline checkbox -->
            <input
              type="checkbox"
              class="mr-1 cursor-pointer"
              use:tooltip={{ content: 'Border. Disabled for samples with >100,000 points.' }}
              on:change={(e) => setVisible(uid, e.currentTarget.checked, true)}
              data-testid="overlay-toggle-border"
            />

            <!-- Fill checkbox -->
            <input
              type="checkbox"
              class="cursor-pointer"
              class:opacity-70={$sOverlay !== ov.uid}
              checked
              use:tooltip={{ content: 'Fill' }}
              on:change={(e) => setVisible(uid, e.currentTarget.checked)}
              data-testid="overlay-toggle-fill"
            />
            &nbsp;
          </td>
          <!-- Overlay name -->
          <td class:opacity-70={$sOverlay !== ov.uid}>
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
          </td>
          <td class="w-full" />
          <td class="flex items-center mr-1">
            <!-- Colormap/scale adjustments -->
            <OverlayAdjust {ov} />
            <!-- circle -->
          </td>
          <!-- Opacity bar -->
          <td>
            <input
              title="Overlay opacity"
              class="max-w-[5rem] -translate-y-0.5 cursor-pointer align-middle opacity-80"
              class:opacity-70={$sOverlay !== ov.uid}
              type="range"
              min="0"
              max="1"
              value="0.8"
              step="0.01"
              on:change={(e) => setStyleVars(uid, { opacity: e.currentTarget.value })}
              on:mousemove={(e) => setStyleVars(uid, { opacity: e.currentTarget.value })}
              use:tooltip={{ content: 'Opacity' }}
              data-testid="overlay-opacity"
            />
          </td>
          <td class="h-4 w-4">
            {#if i !== 0}
              <button
                class="flex cursor-pointer items-center pl-1 opacity-80 transition-opacity hover:opacity-100"
                title={`Remove ${fg?.feature}`}
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
    </tbody>
  {/if}
</table>

<!-- Link button -->
<!-- {#if Object.entries($overlays).length > 1}
  <div class="flex justify-center">
    <button
      class={classes(
        'flex rounded  w-fit p-1 px-2',
        linkMinmax ? 'bg-sky-600 text-neutral-200' : 'bg-neutral-700 text-neutral-500'
      )}
      on:click={() => {
        linkMinmax = !linkMinmax;
        if (linkMinmax) {
          const min = Math.min(...Object.values($overlays).map((o) => o.currStyleVariables?.min));
          const max = Math.max(...Object.values($overlays).map((o) => o.currStyleVariables?.max));
          for (const ov of Object.values($overlays)) {
            ov.updateStyleVariables({ min, max });
          }
        }
      }}
    >
      {#if linkMinmax}
        <Icon src={Link} class="svg-icon mr-1 h-[14px] w-[14px] translate-y-[2.5px] stroke-[2.5]" />
      {/if}
      Link min/max
    </button>
  </div>
{/if} -->

<div class="flex w-full justify-center border-t border-t-white/30">
  <!-- <FileInput accept=".csv" on:import={addOverlay}> -->
  <div
    class="mt-1.5 flex cursor-pointer items-center transition-opacity hover:font-semibold hover:text-white"
    on:click={addOverlay}
    data-testid="overlay-add-layer"
  >
    <Icon src={Plus} class="svg-icon mr-1 h-[14px] w-[14px] translate-y-[1px] stroke-[2.5]" />
    <div class="font-normal">Add Layer</div>
  </div>
  <!-- </FileInput> -->
</div>

<!-- use:tooltip={{
        content: 'CSV file with columns: `x`, `y` in pixels, and optional `id`.'
      }} -->
