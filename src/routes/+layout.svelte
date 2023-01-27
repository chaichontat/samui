<script lang="ts">
  import { handleError } from '$src/lib/utils';
  import { onMount } from 'svelte';
  import '../app.css';

  onMount(() => {
    window.onunhandledrejection = (e: PromiseRejectionEvent) => {
      handleError(e);
    };
  });
</script>

<slot />
