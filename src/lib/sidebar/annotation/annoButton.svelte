<script lang="ts">
  import { classes } from '$src/lib/utils';

  let cl = '';
  export { cl as class };
  export let onClick: (e: MouseEvent) => void = () => {};
  export let disabled = false;
  export let ping = false;
</script>

<button
  class={classes(
    ping ? ' bg-orange-700 shadow-orange-700/30 hover:bg-orange-600' : cl,
    'px-4 relative flex justify-center items-center gap-x-0.5 rounded-lg py-1 font-medium shadow-lg transition-[background-color]',
    'disabled:cursor-auto disabled:bg-neutral-500 hover:disabled:bg-neutral-500 disabled:text-neutral-300 disabled:shadow-none disabled:opacity-50'
  )}
  {disabled}
  on:click={onClick}
>
  {#if ping}
    <span
      class="absolute inline-flex h-full w-full animate-ping rounded-lg bg-orange-400 opacity-30 delay-200"
    />
    Stop
  {:else}
    <slot />
  {/if}
</button>
