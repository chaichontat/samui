<script lang="ts">
  import type { FeatureAndGroup } from '../data/objects/feature';
  import { hoverSelect, setHoverSelect } from '../store';
  import { clickOutside } from '../ui/utils';

  export let feature: FeatureAndGroup;
  export { cl as class };
  let cl = 'cursor-pointer underline-offset-2 text-yellow-300 hover:text-yellow-200';
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
  <slot>
    <div
      class={$hoverSelect.selected?.feature === feature.feature
        ? 'drop-shadow-3xl font-semibold underline opacity-100 shadow-white'
        : 'opacity-80'}
    >
      {feature.feature}
    </div>
  </slot>
</button>
