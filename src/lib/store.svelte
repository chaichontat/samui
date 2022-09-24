<script lang="ts">
  import { mapIdSample, samples, sMapId, sSample } from './store';

  $: $sSample = $samples[$mapIdSample[$sMapId]];
</script>
