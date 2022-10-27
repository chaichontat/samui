<script lang="ts">
  import { onMount } from 'svelte';
  import '../app.css';

  onMount(() => {
    window.onunhandledrejection = (e: PromiseRejectionEvent) => {
      alert('Unhandled error: ' + (e.reason as string));
    };
  });
</script>

<slot />
