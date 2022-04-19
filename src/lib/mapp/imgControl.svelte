<script lang="ts">
  import ButtonGroup from '../components/buttonGroup.svelte';
  import type { ImageCtrl } from './imgControl';

  export let mode: 'composite' | 'rgb' = 'composite';
  export let names: string[] = [];
  export let imgCtrl: ImageCtrl;

  $: imgCtrl;
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
