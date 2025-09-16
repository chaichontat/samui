<script lang="ts">
  import Section from '$lib/sidebar/section.svelte';
  import { setHoverSelect, sPixel, sSample } from '$lib/store';
  import FeatAnnotate from '$src/lib/sidebar/annotation/AnnFeat.svelte';
  import ROIAnnotate from '$src/lib/sidebar/annotation/AnnROI.svelte';
  import HoverableFeature from '$src/lib/sidebar/hoverableFeature.svelte';
  // import Markdown from '$src/lib/sidebar/markdown.svelte'; // Dynamic import
  import Nav from '$src/lib/sidebar/nav.svelte';
  import Recent from '$src/lib/sidebar/recent.svelte';
  // import Plot from './plot.svelte'; // Dynamic import

  $: hasFeature =
    $sSample &&
    (Object.keys($sSample?.coords).length > 0 || Object.keys($sSample?.features).length > 0);
</script>

<div class="z-40 w-full">
  <Nav />
</div>

<div
  class="flex flex-col items-center divide-y divide-neutral-700 border-y border-y-neutral-700 overflow-x-visible"
>
  <Section
    title="ROI Annotation"
    class="overflow-visible"
    tooltipMsg="Draw and label regions of the image."
  >
    <ROIAnnotate />
  </Section>

  {#if hasFeature}
    <Section title="Recent Features" defaultOpen>
      <Recent />
    </Section>

    {#if $sSample?.overlayParams?.importantFeatures}
      <Section title="Features of Interest" defaultOpen class="flex flex-wrap gap-x-3">
        {#if $sSample?.overlayParams?.importantFeatures}
          {#each $sSample.overlayParams.importantFeatures as feature}
            <HoverableFeature
              {feature}
              set={setHoverSelect}
              data-testid="feature-of-interest-button"
            />
          {/each}
        {/if}
      </Section>
    {/if}

    <!-- <Section title="Overlay Options" defaultOpen>
      Min value: <input type="range" />
      Max value: <input type="range" />
    </Section> -->

    <!-- <Section title="Density Plots" defaultOpen class="flex justify-center overflow-visible">
      {#await import('$src/lib/sidebar/plot/plotMini.svelte') then plot}
        <svelte:component this={plot.default} />
      {/await}
    </Section> -->

    <Section
      title="Feature Annotation"
      class="overflow-visible"
      tooltipMsg="Assign labels to existing points (overlay)."
    >
      <FeatAnnotate />
    </Section>
  {/if}

  <Section title="Notes" defaultOpen class="-mt-4">
    {#if $sSample?.notesMd}
      {#await import('$src/lib/sidebar/markdown.svelte') then markdown}
        <div data-testid="notes-content">
          <svelte:component this={markdown.default} url={$sSample.notesMd.url} class="leading-6" />
        </div>
      {/await}
    {:else}
      <div data-testid="notes-content">No notes.</div>
    {/if}
  </Section>

  {#if $sSample?.metadataMd}
    {#await import('$src/lib/sidebar/markdown.svelte') then markdown}
      <Section title="Metadata">
        <div data-testid="metadata-content">
          <svelte:component
            this={markdown.default}
            class="overflow-x-scroll pl-4 -indent-4 font-mono text-xs"
            url={$sSample?.metadataMd.url}
          />
        </div>
      </Section>
    {/await}
  {/if}

  <div class="w-full flex flex-col items-center">
    <div class="mt-3 text-center font-mono text-sm">
      {#if $sPixel}
        Position: ({Math.round($sPixel[0])}, {Math.round($sPixel[1])})
      {/if}
    </div>

    <div class="flex-grow min-h-[24px]" />

    <div class="mx-auto justify-end text-xs text-center">
      Samui {__VERSION__}
    </div>

    <a
      class="mb-6 mt-2 mx-auto text-xs relative inline-flex w-fit items-center justify-center overflow-hidden rounded p-0.5 focus:outline-none focus:ring group bg-gradient-to-br from-cyan-600 to-blue-600 text-neutral-900 hover:text-neutral-50  focus:ring-cyan-500 dark:text-neutral-100 dark:focus:ring-cyan-800"
      href="https://github.com/chaichontat/samui/issues"
      target="_blank"
      rel="noreferrer"
    >
      <span
        class="flex items-center gap-x-2 rounded bg-neutral-50 bg-opacity-80 backdrop-blur transition-all duration-75 ease-in dark:bg-neutral-900 dark:bg-opacity-80 px-2 py-1 group-hover:bg-opacity-0"
      >
        Report Issue
      </span>
    </a>
  </div>
</div>

<!-- <div class="mt-6 text-sm">
  <Status />
</div> -->
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
