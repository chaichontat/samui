<script lang="ts">
  import {
    hoverSelect,
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
  $: $overlaysFeature[$sOverlay] = $hoverSelect.active;
</script>
