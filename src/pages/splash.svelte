<script lang="ts">
  import Github from '$src/lib/components/github.svelte';
  import { byod } from '$src/lib/data/byod';
  import { Plus } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';
</script>

<!-- Splash import -->
<nav class="flex w-full justify-between py-[18px] pl-4 pr-4 gap-x-4">
  <div class="text-2xl font-medium">
    🏝️ <a
      href="https://en.wikipedia.org/wiki/Ko_Samui"
      class="animate-text bg-gradient-to-br from-yellow-100 via-yellow-200 to-teal-400 bg-clip-text text-transparent duration-300 ease-in-out"
    >
      Samui
    </a>
  </div>
  <div class="flex-grow" />
  <Github />
</nav>

<div class="center flex flex-col items-center justify-center gap-y-5">
  <div class="flex flex-col items-center">
    <button
      class="splash-button group mb-1 rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 text-xl font-medium text-neutral-50 ring-pink-800"
      on:click={byod}
    >
      <span class="flex items-center px-5 py-3 group-hover:bg-opacity-0">
        <Icon src={Plus} class="h-4 w-4 translate-y-[1px] stroke-current stroke-[4]" />
        Import Sample
      </span>
    </button>
    <p class="text-neutral-200 text-center">
      Or drag and drop your sample folder!
      <br />
      Preprocessing instructions available
      <a
        class="text-blue-400 hover:underline"
        href="https://github.com/chaichontat/samui#example-preprocessing"
      >
        here.
      </a>
    </p>
  </div>

  <a
    href="/from?url=data.samuibrowser.com/VisiumIF/&s=Br2720_Ant_IF&s=Br6432_Ant_IF&s=Br6522_Ant_IF&s=Br8667_Post_IF"
    class="splash-button group rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 text-lg font-medium text-neutral-900 hover:text-neutral-50 focus:ring-cyan-200 dark:text-neutral-100 dark:focus:ring-cyan-800"
  >
    <span class="px-5 py-2 group-hover:bg-opacity-0">Show Visium-IF Data</span>
  </a>

  <a
    href="/from?url=data.samuibrowser.com/merfish/&s=BrainReceptorShowcase"
    class="splash-button group rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 text-lg font-medium text-neutral-900 hover:text-neutral-50 focus:ring-emerald-200 dark:text-neutral-100 dark:focus:ring-emerald-800"
  >
    <span class="px-5 py-2 group-hover:bg-opacity-0">Show MERFISH Data</span>
  </a>
</div>

<div class="absolute bottom-5 left-1/2 translate-x-[-50%] text-center text-neutral-300">
  All processing is done locally. Your data never leave your computer.
</div>
