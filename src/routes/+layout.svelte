<script lang="ts">
  import { handleError } from '$src/lib/utils';
  import {
    annoFeat,
    annoROI,
    hoverSelect,
    overlays,
    sEvent,
    sMapp,
    sOverlay
  } from '$lib/store';
  import { get } from 'svelte/store';
  import { onMount } from 'svelte';
  import '../app.css';

  onMount(() => {
    window.onunhandledrejection = (e: PromiseRejectionEvent) => {
      handleError(e);
    };

    (window as any).__SAMUI__ = {
      stores: {
        sMapp: () => get(sMapp),
        overlays: () => get(overlays),
        sOverlay: () => get(sOverlay),
        sEvent: () => get(sEvent),
        annoFeat: () => get(annoFeat),
        annoROI: () => get(annoROI),
        hoverSelect: () => get(hoverSelect)
      }
    };
  });
</script>

<slot />
