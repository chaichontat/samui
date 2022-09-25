<script lang="ts">
  import {
    hoverSelect,
    mapIdSample,
    overlaysFeature,
    samples,
    sMapId,
    sOverlay,
    sSample
  } from './store';

  $: $sSample = $samples[$mapIdSample[$sMapId]];
  $: $overlaysFeature[$sOverlay] = $hoverSelect.active;
</script>
