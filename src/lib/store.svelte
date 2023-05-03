<script lang="ts">
  import type { FeatureAndGroup } from './data/objects/feature';
  import {
    hoverSelect,
    mapIdSample,
    overlaysFeature,
    samples,
    sMapId,
    sOverlay,
    sSample
  } from './store';

  $: $sSample = $samples.find((x) => x.name === $mapIdSample[$sMapId])?.sample;

  const updateOverlay = (fg: FeatureAndGroup | undefined) => ($overlaysFeature[$sOverlay] = fg);
  $: updateOverlay($hoverSelect.active);

  // $: if ($sEvent?.type === 'viewAdjusted') adjustSize()
  // const adjustSize = () => {
  //   for (const map of $)
  // }
</script>
