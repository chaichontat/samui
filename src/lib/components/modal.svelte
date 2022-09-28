<script lang="ts">
  import { fade } from 'svelte/transition';

  export let animateIn = true;
  export let animateOut = true;
  type Arg = Parameters<typeof fade>;
  const animate = (node: Arg[0], args: Arg[1] | { enabled?: boolean }) =>
    args!.enabled
      ? fade(node, { duration: 150, ...args })
      : (node: Arg[0], args: Arg[1]) => ({} as ReturnType<typeof fade>);
</script>

<div
  in:animate={{ enabled: animateIn }}
  out:animate={{ enabled: animateOut }}
  class="absolute top-0 left-0 z-50 flex h-full w-full items-center justify-center bg-black bg-opacity-50"
>
  <div
    class="flex h-1/4 w-1/2 flex-col items-center justify-center rounded-lg bg-slate-700 text-2xl font-medium text-white"
  >
    <slot />
  </div>
</div>
