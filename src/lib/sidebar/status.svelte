<script lang="ts">
  import { annotating, sOverlay } from '$lib/store';
  import { classes } from '../utils';

  $: s =
    classes(
      $annotating.currKey !== null
        ? `labeling ${$annotating.keys[$annotating.currKey]} on ${$sOverlay}`
        : ''
    ) || 'idle.';
</script>

<code>Status: {s} </code>
