<script lang="ts">
import {
  annoFeat,
  annoROI,
  hoverSelect,
  overlays,
  sEvent,
  sFeatureData,
  sMapp,
  sOverlay
} from '$lib/store';
import { handleError } from '$src/lib/utils';
import { get } from 'svelte/store';
import { onMount } from 'svelte';
import '../app.css';

if (typeof window !== 'undefined') {
  (window as any).__SAMUI__ = {
    stores: {
      sMapp: () => get(sMapp),
      overlays: () => get(overlays),
      sOverlay: () => get(sOverlay),
      sEvent: () => get(sEvent),
      annoFeat: () => get(annoFeat),
      annoROI: () => get(annoROI),
      hoverSelect: () => get(hoverSelect),
      sFeatureData: () => get(sFeatureData)
    }
  };
}

  onMount(() => {
    window.onunhandledrejection = (e: PromiseRejectionEvent) => {
      handleError(e);
    };

    const unsub = sEvent.subscribe((evt) => {
      document.body.dataset.renderComplete = evt?.type === 'renderComplete' ? 'true' : 'false';
    });

    return () => {
      unsub();
      delete document.body.dataset.renderComplete;
      delete (window as any).__SAMUI__;
    };
  });
</script>

<slot />
