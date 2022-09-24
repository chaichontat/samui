<script lang="ts">
  import Nav from '$src/lib/sidebar/nav.svelte';
</script>

<aside class="relative flex h-full w-full flex-1 flex-col overflow-y-auto px-4">
  <div class="z-40 w-full">
    <Nav />
  </div>

  <div class="mt-3 flex flex-col items-center gap-y-4 divide-y dark:divide-slate-700">
    <!-- <Section title="Annotations">
      <Annotate />
    </Section> -->
  </div>

  <div class="mt-6 text-sm">
    <!-- <Status /> -->
  </div>
</aside>

<style lang="postcss">
  section {
    @apply relative hidden w-[90%] pt-4 lg:block;
  }

  :global(.tab) {
    @apply w-full rounded-lg py-2.5 px-2 text-sm font-medium leading-5 text-slate-500 ring-opacity-60 ring-offset-2 hover:bg-indigo-100 focus:outline-none;
  }

  :global(.dark .tab) {
    @apply bg-slate-800 text-slate-100 ring-white ring-offset-slate-500 hover:bg-slate-700;
  }

  :global(.tab-selected) {
    @apply bg-indigo-300/50 font-semibold text-indigo-800 hover:bg-indigo-300/50;
  }

  :global(.dark .tab-selected) {
    @apply bg-slate-600 text-white hover:bg-slate-600 active:bg-slate-500;
  }
</style>
