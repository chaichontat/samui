<script lang="ts">
  import type { FeatureAndGroup } from '../data/objects/feature';
  import { setHoverSelect } from '../store';
  import { clickOutside } from '../ui/utils';

  export let feature: FeatureAndGroup;
  export { cl as class };
  let cl = 'cursor-pointer font-semibold text-yellow-300 hover:text-yellow-200';
</script>

<button
  class={cl}
  use:clickOutside
  on:mouseover={() => setHoverSelect({ hover: feature })}
  on:focus={() => setHoverSelect({ hover: feature })}
  on:mouseout={() => setHoverSelect({ hover: undefined })}
  on:blur={() => setHoverSelect({ hover: undefined })}
  on:click={() => setHoverSelect({ selected: feature })}
>
  {feature.feature}
</button>
