<script lang="ts">
  import { sEvent } from '$lib/store';
  import { handleError } from '$src/lib/utils';
  import { onMount } from 'svelte';
  import '../app.css';

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
    };
  });
</script>

<slot />
