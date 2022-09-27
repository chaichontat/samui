<script lang="ts">
  import preload from '$lib/data/preload';
  import Github from '$src/lib/components/github.svelte';
  import { byod } from '$src/lib/data/byod';
</script>

<!-- Splash import -->
<nav class="flex w-full justify-between py-3 px-5">
  <div class="text-2xl font-medium text-yellow-300">Loopy Browser</div>
  <Github />
</nav>

<div class="center flex flex-col items-center gap-y-3">
  <button
    class="splash-button group mb-2 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 text-xl font-medium text-gray-900 hover:text-slate-50 focus:ring-pink-200 dark:text-slate-100 dark:focus:ring-pink-800"
    on:click={byod}
  >
    <span class="flex items-center gap-x-2 px-5 py-3 group-hover:bg-opacity-0">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4 translate-y-[1px] stroke-[4]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      Import Sample
    </span>
  </button>

  <button
    class="splash-button group rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 text-lg font-medium text-gray-900 hover:text-slate-50  focus:ring-cyan-200 dark:text-slate-100 dark:focus:ring-cyan-800"
    on:click={preload}
  >
    <span class="px-5 py-2 group-hover:bg-opacity-0">Show Visium-IF Data</span>
  </button>
</div>

<div class="absolute bottom-5 left-1/2 translate-x-[-50%] text-gray-300">
  All processing is done locally. Your data never leave your computer.
</div>
