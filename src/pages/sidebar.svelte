<script lang="ts">
  import Section from '$lib/sidebar/section.svelte';
  import { sPixel, sSample } from '$lib/store';
  import FeatAnnotate from '$src/lib/sidebar/annotation/AnnFeat.svelte';
  import ROIAnnotate from '$src/lib/sidebar/annotation/AnnROI.svelte';
  import HoverableFeature from '$src/lib/sidebar/hoverableFeature.svelte';
  import Markdown from '$src/lib/sidebar/markdown.svelte';
  import Nav from '$src/lib/sidebar/nav.svelte';
  import Recent from '$src/lib/sidebar/recent.svelte';
  import Plot from './plot.svelte';

  export let showSidebar: boolean;
</script>

<div class="z-40 w-full">
  <Nav />
</div>

<div class="flex flex-col items-center divide-y divide-neutral-700 border-y border-y-neutral-700">
  <Section title="Recent Features" defaultOpen>
    <Recent />
  </Section>

  {#if $sSample?.overlayParams?.importantFeatures}
    <Section title="Features of Interest" defaultOpen class="flex flex-wrap gap-x-3">
      {#each $sSample?.overlayParams?.importantFeatures as feature}
        <HoverableFeature {feature} />
      {/each}
    </Section>
  {/if}

  <!-- <Section title="Overlay Options" defaultOpen>
      Min value: <input type="range" />
      Max value: <input type="range" />
    </Section> -->

  <Section title="Histogram" defaultOpen class="flex justify-center overflow-visible">
    <Plot />
  </Section>

  <Section
    title="ROI Annotation"
    class="overflow-visible"
    tooltipMsg="Draw and label regions of the image."
  >
    <ROIAnnotate />
  </Section>

  <Section
    title="Feature Annotation"
    class="overflow-visible"
    tooltipMsg="Assign labels to existing points (overlay)."
  >
    <FeatAnnotate />
  </Section>

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
        class="overflow-x-scroll pl-4 -indent-4 font-mono text-xs"
        url={$sSample?.metadataMd.url}
      />
    {:else}
      No metadata.
    {/if}
  </Section>
</div>

<div class="mt-3 text-center font-mono text-sm">
  {#if $sPixel}
    Position: ({Math.round($sPixel[0])}, {Math.round($sPixel[1])})
  {/if}
</div>

<div class="mt-6 text-sm">
  <!-- <Status /> -->
</div>

<style lang="postcss">
  section {
    @apply relative hidden w-[90%] pt-4 md:block;
  }

  :global(.tab) {
    @apply w-full rounded-lg py-2.5 px-2 text-sm font-medium leading-5 text-neutral-500 ring-opacity-60 ring-offset-2 hover:bg-indigo-100 focus:outline-none;
  }

  :global(.dark .tab) {
    @apply bg-neutral-800 text-neutral-100 ring-white ring-offset-neutral-500 hover:bg-neutral-700;
  }

  :global(.tab-selected) {
    @apply bg-indigo-300/50 font-semibold text-indigo-800 hover:bg-indigo-300/50;
  }

  :global(.dark .tab-selected) {
    @apply bg-neutral-600 text-white hover:bg-neutral-600 active:bg-neutral-500;
  }
</style>
