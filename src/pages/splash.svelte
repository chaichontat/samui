<script lang="ts">
  import preload from '$lib/data/preload';
  import Github from '$src/lib/components/github.svelte';
  import { byod } from '$src/lib/data/byod';
  import { Plus } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';
</script>

<!-- Splash import -->
<nav class="flex w-full justify-between py-3 px-5">
  <div class="text-2xl font-medium text-yellow-300">Loopy Browser</div>
  <Github />
</nav>

<div class="center flex h-full w-full flex-col items-center justify-center gap-y-5">
  <div class="flex flex-col items-center">
    <button
      class="splash-button group mb-1 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 text-xl font-medium text-slate-50 ring-pink-800"
      on:click={byod}
    >
      <span class="flex items-center px-5 py-3 group-hover:bg-opacity-0">
        <Icon src={Plus} class="h-4 w-4 translate-y-[1px] stroke-current stroke-[4]" />
        Import Sample
      </span>
    </button>
    <p class="text-slate-200">Or drag and drop your sample folder!</p>
  </div>

  <button
    class="splash-button group rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 text-lg font-medium text-gray-900 hover:text-slate-50  focus:ring-cyan-200 dark:text-slate-100 dark:focus:ring-cyan-800"
    on:click={preload}
  >
    <span class="px-5 py-2 group-hover:bg-opacity-0">Show Visium-IF Data</span>
  </button>

  <div class="absolute bottom-5 left-1/2 translate-x-[-50%] text-center text-gray-300">
    All processing is done locally. Your data never leave your computer.
  </div>
</div>
