<script lang="ts">
  import Colorbar from '$lib/components/colorbar.svelte';
  import type { Mapp } from '../mapp';
  import OverlayTool from './overlayTool.svelte';

  export let map: Mapp;
  export let showImgControl: boolean;
  export let colorbar = true;
  export let width = 0;
</script>

<section
  class="absolute right-4 top-4 z-20 flex gap-3"
  class:top-16={width < 500 && showImgControl}
>
  <!-- Show/hide -->
  <button
    class="z-20 mt-1 h-9"
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

  <!-- Overlay selector -->
  <div>
    {#if showImgControl}
      <OverlayTool {map} />
    {/if}
  </div>
</section>

{#if colorbar}
  <div class="pointer-events-none absolute right-6 bottom-4 z-20">
    <Colorbar title="Log" color="turbo" min={0} max={10} />
  </div>
{/if}
