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
  import { classes, cn } from '$src/lib/utils';
  import { Check } from '@lucide/svelte';
  import { Plus, XMark } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { Checkbox } from 'bits-ui';
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
  const ensureState = (uid: string) => {
    if (!(uid in outlinevis)) {
      outlinevis[uid] = $overlays[uid]?.outline?.visible ?? false;
    }
    if (!(uid in visible)) {
      const layerVisible = $overlays[uid]?.layer?.getVisible?.();
      visible[uid] = layerVisible == undefined ? true : layerVisible;
    }
  };
  $: Object.keys($overlays).forEach(ensureState);
  const setVisible = (name: string, c: boolean | null, outline = false) => {
    ensureState(name);
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

<table
  class="min-w-[250px] table-fixed ml-1 mt-1"
  title="Overlay tools"
  data-testid="overlay-table"
  data-render-complete={$sEvent?.type === 'renderComplete' ? 'true' : 'false'}
  data-feature-min={$sFeatureData?.minmax?.[0] ?? ''}
  data-feature-max={$sFeatureData?.minmax?.[1] ?? ''}
  data-view-zoom={$sMapp?.map?.getView()?.getZoom?.() ?? ''}
  data-view-center={$sMapp?.map?.getView()?.getCenter?.()?.join(',') ?? ''}
>
  {#if sample}
    <tbody>
      {#each Object.entries($overlays) as [uid, ov], i}
        {@const fg = $overlaysFeature[uid]}
        <tr
          data-testid={`overlay-row-${i}`}
          data-selected={uid === $sOverlay}
          data-overlay-uid={uid}
          data-overlay-feature={fg?.feature ?? ''}
          data-overlay-group={fg?.group ?? ''}
          data-overlay-colormap={ov.currColorMap ?? ''}
          data-overlay-style={ov.currStyle}
          data-overlay-visible={String(ov.layer?.getVisible?.() ?? false)}
          data-overlay-outline-visible={String(ov.outline?.visible ?? false)}
          data-overlay-opacity={
            ov.currStyleVariables?.opacity != undefined ? `${ov.currStyleVariables.opacity}` : ''
          }
          data-overlay-min={
            ov.currStyleVariables?.min != undefined ? `${ov.currStyleVariables.min}` : ''
          }
          data-overlay-max={
            ov.currStyleVariables?.max != undefined ? `${ov.currStyleVariables.max}` : ''
          }
        >
          <!-- <td class="size-3">
            <Icon
              src={ArrowLongRight}
              class={classes('svg-icon mr-1', $sOverlay === ov.uid ? '' : 'invisible')}
            />
          </td> -->
          <td class="flex items-center gap-x-0.5" class:opacity-60={$sOverlay !== ov.uid}>
            <!-- Outline checkbox -->
            <div class="size-4" use:tooltip={{ content: `${fg?.feature} outline` }}>
              <Checkbox.Root
                class="bg-transparent  border-white/70  data-[state=unchecked]:hover:border-dark-40 peer inline-flex size-4 items-center justify-center rounded border"
                name={`Border outline for ${fg?.feature}`}
                checked={outlinevis[uid]}
                onCheckedChange={(e) => setVisible(uid, e, true)}
                data-testid="overlay-toggle-border"
              >
                {#snippet children({ checked })}
                  <div class="text-white/90 inline-flex items-center justify-center">
                    <Check class={cn('size-4', !checked && 'invisible')} />
                  </div>
                {/snippet}
              </Checkbox.Root>
            </div>

            <div class="size-4" use:tooltip={{ content: `${fg?.feature} fill` }}>
              <Checkbox.Root
                class="bg-transparent border-white/70  data-[state=unchecked] data-[state=unchecked]:hover:border-dark-40 peer inline-flex size-4 items-center justify-center rounded border"
                name={`Border outline for ${fg?.feature}`}
                checked={visible[uid]}
                onCheckedChange={(e) => setVisible(uid, e)}
                data-testid="overlay-toggle-fill"
              >
                {#snippet children({ checked })}
                  <div class="text-white/90 inline-flex items-center justify-center">
                    <Check class={cn('size-4', !checked && 'invisible')} />
                  </div>
                {/snippet}
              </Checkbox.Root>
            </div>
            &nbsp;
          </td>
          <!-- Overlay name -->
          <td class:opacity-70={$sOverlay !== ov.uid}>
            <button
              on:click={() => ($sOverlay = uid)}
              aria-label={`Select ${fg?.feature}`}
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
            </button>
          </td>
          <td class="w-full"></td>
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
          <td class="min-w-6">
            {#if i !== 0}
              <button
                class="flex cursor-pointer items-center opacity-70 ml-1 transition-opacity hover:opacity-100"
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
                <Icon src={XMark} class="svg-icon stroke-[2.5px]" />
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
