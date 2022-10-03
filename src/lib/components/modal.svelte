<script lang="ts">
  import { fade } from 'svelte/transition';

  export let animateIn = true;
  export let animateOut = true;
</script>

<div
  transition:fade={{ duration: 150 }}
  class="absolute top-0 left-0 z-50 flex h-full w-full items-center justify-center bg-black bg-opacity-50"
>
  <div
    class="flex h-1/4 w-1/2 flex-col items-center justify-center rounded-xl bg-neutral-700 text-2xl font-medium text-white"
  >
    <slot />
  </div>
</div>
