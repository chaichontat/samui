<script lang="ts">
  import type { FeatureAndGroup } from '../data/objects/feature';
  import { hoverSelect, type SimpleHS } from '../store';
  import { clickOutside } from '../ui/utils';
  import { classes } from '../utils';

  export let feature: FeatureAndGroup;
  export let set:
    | ((v: SimpleHS<FeatureAndGroup>) => void)
    | ((v: SimpleHS<FeatureAndGroup>) => Promise<void>);
  export let selectEnabled = true;
  export { cl as class };
  export let textClass = '';
  let cl = 'text-yellow-300 hover:text-yellow-200';
</script>

<button
  class={'text-ellipsis cursor-pointer underline-offset-2 ' + cl}
  use:clickOutside
  on:mouseover={() => set({ hover: feature })}
  on:focus={() => set({ hover: feature })}
  on:mouseout={() => set({ hover: undefined })}
  on:blur={() => set({ hover: undefined })}
  on:click={() => selectEnabled && set({ selected: feature })}
>
  <slot>
    <div
      class={classes(
        textClass,
        $hoverSelect.selected?.feature === feature.feature
          ? 'drop-shadow-3xl font-semibold underline opacity-100 shadow-white'
          : 'opacity-80'
      )}
    >
      {feature.feature}
    </div>
  </slot>
</button>
