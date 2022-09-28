<script lang="ts">
  import { ArrowDown } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { fade } from 'svelte/transition';
</script>

<div
  transition:fade={{ duration: 150 }}
  class="absolute top-0 left-0 z-50 flex h-full w-full items-center justify-center bg-black bg-opacity-50"
>
  <div
    class="flex h-1/4 w-1/2 flex-col items-center justify-center rounded-lg bg-slate-700 text-2xl font-medium text-white"
  >
    <div class="mb-2 animate-bounce rounded-full bg-blue-600 p-[10px] drop-shadow-xl">
      <Icon src={ArrowDown} class="h-8 w-8 stroke-current stroke-[3]" />
    </div>
    Drop Sample Here
  </div>
</div>
