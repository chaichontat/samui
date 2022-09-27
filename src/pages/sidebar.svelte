<script lang="ts">
  import Section from '$lib/sidebar/section.svelte';
  import { annotating, sSample } from '$lib/store';
  import Annotate from '$src/lib/sidebar/annotate.svelte';
  import HoverableFeature from '$src/lib/sidebar/hoverableFeature.svelte';
  import Markdown from '$src/lib/sidebar/markdown.svelte';
  import Nav from '$src/lib/sidebar/nav.svelte';
  import Recent from '$src/lib/sidebar/recent.svelte';
  import Plot from './plot.svelte';

  let annToggled = false;
</script>

<aside class="relative flex h-full w-full flex-1 flex-col overflow-y-auto px-4">
  <div class="z-40 w-full">
    <Nav />
  </div>

  <div class="mt-3 flex flex-col items-center gap-y-4 ">
    <Section title="Recent Features" defaultOpen>
      <Recent />
    </Section>

    <!-- <Section title="Overlay Options" defaultOpen>
      Min value: <input type="range" />
      Max value: <input type="range" />
    </Section> -->

    <Section title="Histogram" defaultOpen class="overflow-visible">
      <Plot />
    </Section>

    <Section title="Annotations" bind:toggled={annToggled} togglable defaultOpen>
      <Annotate toggled={annToggled} />
    </Section>

    {#if $sSample?.overlayParams?.importantFeatures}
      <Section title="Features of Interest" defaultOpen class="flex flex-wrap gap-x-3">
        {#each $sSample?.overlayParams?.importantFeatures as feature}
          <HoverableFeature {feature} />
        {/each}
      </Section>
    {/if}

    <Section title="Notes" defaultOpen>
      {#if $sSample?.notesMd}
        <Markdown url={$sSample.notesMd.url} />
      {:else}
        No notes.
      {/if}
    </Section>

    <Section title="Metadata">
      {#if $sSample?.metadataMd}
        <Markdown
          class="overflow-x-scroll pl-4 -indent-4 font-mono text-sm"
          url={$sSample?.metadataMd.url}
        />
      {:else}
        No metadata.
      {/if}
    </Section>
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
