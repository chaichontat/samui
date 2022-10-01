<script lang="ts">
  import {
    hoverSelect,
    mapIdSample,
    overlaysFeature,
    samples,
    sEvent,
    sMapId,
    sOverlay,
    sSample
  } from './store';

  $: $sSample = $samples[$mapIdSample[$sMapId]];
  $: $overlaysFeature[$sOverlay] = $hoverSelect.active;

  // $: if ($sEvent?.type === 'viewAdjusted') adjustSize()
  // const adjustSize = () => {
  //   for (const map of $)
  // }
</script>
