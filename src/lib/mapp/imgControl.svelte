<script lang="ts">
  import ButtonGroup from '../components/buttonGroup.svelte';
  import type { ImageCtrl } from './imgControl';

  export let channels: string[] | 'rgb' | null = null;
  export let small = false;

  let names = channels;
  const _ic: ImageCtrl =
    channels === 'rgb'
      ? { type: 'rgb', Exposure: 0, Contrast: 0, Saturation: 0 }
      : {
          type: 'composite',
          showing: [names![0], names![0], names![0]],
          maxIntensity: [128, 128, 128]
        };

  export let imgCtrl: ImageCtrl = _ic;
  imgCtrl = _ic; // Override from upstream.
</script>

{#if imgCtrl}
  {#if channels !== 'rgb'}
    {#each ['blue', 'green', 'red'] as color, i}
      <div class:gap-x-2={small} class:gap-x-4={!small} class="flex">
        <ButtonGroup {names} bind:curr={imgCtrl.showing[i]} {color} {small} addNone />
        <input
          type="range"
          min="0"
          max="254"
          bind:value={imgCtrl.maxIntensity[i]}
          class="ml-1 min-w-[4rem] max-w-[12rem] cursor-pointer"
        />
        <div>&nbsp;</div>
      </div>
    {/each}
  {:else}
    <div class="grid grid-cols-3 gap-y-1.5 gap-x-1">
      {#each ['Exposure', 'Contrast', 'Saturation'] as name}
        <div class="px-1">{small ? name.slice(0, 3) : name}:</div>
        <input
          type="range"
          min="-0.5"
          step="0.01"
          max="0.5"
          bind:value={imgCtrl[name]}
          class="col-span-2 min-w-[4rem] max-w-[12rem] cursor-pointer"
        />
      {/each}
    </div>
  {/if}
{/if}
