<script lang="ts">
  import ButtonGroup from '../components/buttonGroup.svelte';
  import type { ImageCtrl, ImageMode } from './imgControl';

  export let mode: ImageMode = 'composite';
  export let channels: Record<string, number> | null = null;

  let names = channels ? Object.keys(channels) : null;
  const _ic: ImageCtrl =
    mode === 'composite'
      ? {
          type: 'composite',
          showing: [names![0], names![0], names![0]],
          maxIntensity: [128, 128, 128]
        }
      : { type: 'rgb', Exposure: 0, Contrast: 0, Saturation: 0 };

  export let imgCtrl: ImageCtrl = _ic;
  imgCtrl = _ic; // Override from upstream.
</script>

{#if imgCtrl}
  {#if mode === 'composite'}
    {#each ['blue', 'green', 'red'] as color, i}
      <div class="flex gap-x-4">
        <ButtonGroup {names} bind:curr={imgCtrl.showing[i]} {color} addNone />
        <input
          type="range"
          min="0"
          max="254"
          bind:value={imgCtrl.maxIntensity[i]}
          class="min-w-[4rem] max-w-[16rem] flex-grow cursor-pointer"
        />
      </div>
    {/each}
  {:else}
    <div class="grid grid-cols-3 gap-y-1.5 gap-x-1">
      {#each ['Exposure', 'Contrast', 'Saturation'] as name}
        <div class="px-1">{name}:</div>
        <input
          type="range"
          min="-0.5"
          step="0.01"
          max="0.5"
          bind:value={imgCtrl[name]}
          class="min-w-[4rem] max-w-[12rem] cursor-pointer col-span-2"
        />
      {/each}
    </div>
  {/if}
{/if}
