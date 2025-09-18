<script lang="ts">
  import Github from '$src/lib/components/github.svelte';
  import ImportInstructionsDialog from '$src/lib/components/ImportInstructionsDialog.svelte';
  import { byod } from '$src/lib/data/byod';
  import { Plus } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';

  let showProcessingGuide = false;
</script>

<!-- Splash import -->
<nav class="flex w-full justify-between py-[18px] pl-4 pr-4 gap-x-4">
  <div class="text-2xl font-medium">
    🏝️ <a
      href="https://en.wikipedia.org/wiki/Ko_Samui"
      class="animate-text bg-linear-to-br from-yellow-100 via-yellow-200 to-teal-400 bg-clip-text text-transparent duration-300 ease-in-out"
    >
      Samui
    </a>
  </div>
  <div class="grow"></div>
  <Github />
</nav>

<div class="center flex flex-col items-center justify-center gap-y-5">
  <div class="flex flex-col items-center mb-2">
    <button
      class="splash-button group mb-1 rounded-lg bg-linear-to-br from-emerald-500 to-green-500 text-xl font-medium text-neutral-50 ring-pink-800"
      on:click={byod}
    >
      <span
        class="flex items-center px-5 py-3 group-hover:bg-neutral-50/0 dark:group-hover:bg-neutral-900/0"
      >
        <Icon src={Plus} class="h-4 w-4 translate-y-px stroke-current stroke-4" />
        Import Sample
      </span>
    </button>

    <div class="text-center text-neutral-200">
      <p>Or drag and drop your sample folder!</p>
      <div class="mt-3 flex flex-col flex-wrap items-center justify-center gap-y-1">
        <button
          type="button"
          class="rounded-lg border border-emerald-500/60 px-3 py-1.5 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/10"
          on:click={() => (showProcessingGuide = true)}
          data-testid="processing-guide-button"
        >
          How do I prepare my data?
        </button>
        <a
          class="text-sm text-blue-400 hover:underline"
          href="https://github.com/chaichontat/samui#example-preprocessing"
        >
          View full README guide
        </a>
      </div>
    </div>
  </div>

  <a
    href="/from?url=data.samuibrowser.com/VisiumIF/&s=Br2720_Ant_IF&s=Br6432_Ant_IF&s=Br6522_Ant_IF&s=Br8667_Post_IF"
    class="splash-button group rounded-lg bg-linear-to-br from-yellow-500 to-yellow-600 text-lg font-medium text-neutral-900 hover:text-neutral-50 focus:ring-cyan-200 dark:text-neutral-100 dark:focus:ring-cyan-800"
  >
    <span class="px-5 py-2 group-hover:bg-neutral-50/0 dark:group-hover:bg-neutral-900/0">
      Show Visium-IF Data
    </span>
  </a>

  <a
    href="/from?url=data.samuibrowser.com/merfish/&s=BrainReceptorShowcase"
    class="splash-button group rounded-lg bg-linear-to-br from-teal-500 to-cyan-500 text-lg font-medium text-neutral-900 hover:text-neutral-50 focus:ring-emerald-200 dark:text-neutral-100 dark:focus:ring-emerald-800"
  >
    <span class="px-5 py-2 group-hover:bg-neutral-50/0 dark:group-hover:bg-neutral-900/0">
      Show MERFISH Data
    </span>
  </a>
</div>

<div class="absolute bottom-5 left-1/2 translate-x-[-50%] text-center text-neutral-300">
  All processing is done locally. Your data never leave your computer.
</div>

<ImportInstructionsDialog bind:open={showProcessingGuide} />
