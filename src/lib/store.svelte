<script lang="ts">
  import {
    mapIdSample,
    overlaysFeature,
    samples,
    sFeature,
    sMapId,
    sOverlay,
    sSample
  } from './store';

  $: $sSample = $samples[$mapIdSample[$sMapId]];
  $: $sFeature = $overlaysFeature[$sOverlay];
</script>
