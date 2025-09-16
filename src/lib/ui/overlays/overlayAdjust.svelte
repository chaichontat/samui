<script lang="ts">
  import type { colorMaps } from '$lib/ui/overlays/featureColormap';
  import DraggableNumber from '$src/lib/components/DraggableNumber.svelte';
  import { sEvent, sFeatureData, sOverlay } from '$src/lib/store';
  import { classes, handleError } from '$src/lib/utils';
  import { Popover } from 'bits-ui';
  import { debounce, throttle } from 'lodash-es';
  import { createEventDispatcher } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { scale } from 'svelte/transition';
  import { tooltip } from '../utils';
  import type { WebGLSpots } from './points';

  export let ov: WebGLSpots;
  let minmax: [number, number] = [ov.currStyleVariables.min ?? 0, ov.currStyleVariables.max ?? 0];
  let colormap: keyof typeof colorMaps = ov.currColorMap ?? 'turbo';
  let style: WebGLSpots['currStyle'] = ov.currStyle;
  const dispatch = createEventDispatcher();

  let colorMapClass: Record<keyof typeof colorMaps, string> = {
    reds: 'bg-red-600',
    greens: 'bg-green-600',
    blues: 'bg-blue-600',
    turbo: 'from-sky-500 via-lime-400 to-red-500',
    viridis: 'from-purple-600 via-teal-400 to-yellow-400',
    inferno: 'from-purple-800 via-orange-500 to-white',
    magma: 'from-purple-800 via-orange-300 to-yellow-400',
    plasma: 'from-purple-600 via-blue-400 to-yellow-400',
    warm: 'from-red-500 via-yellow-500 to-green-100',
    cool: 'from-blue-500 via-cyan-500 to-sky-500',
    cubehelixDefault: 'from-purple-600 via-blue-400 to-yellow-400',
    rainbow: 'from-pink-500 via-green-500 to-purple-400',
    sinebow: 'from-orange-500 via-blue-500 to-red-400',
    greys: 'from-neutral-700 to-white',
    oranges: 'bg-orange-500',
    purples: 'bg-purple-500',
    cividis: 'from-blue-600 to-yellow-400'
  };

  // TODO: need to take into account who's being changed to maintain order
  $: if (minmax[0] > minmax[1]) {
    minmax = [minmax[0], minmax[0]];
  }

  const syncFromOverlay = () => {
    style = ov.currStyle;
    colormap = ov.currColorMap ?? colormap;
    const { min, max } = ov.currStyleVariables;
    if (typeof min === 'number' && typeof max === 'number') {
      minmax = [min, max];
    }
  };

  $: if (minmax[0] === 0 && minmax[1] === 0 && $sFeatureData) {
    minmax = [$sFeatureData.minmax[0], $sFeatureData.minmax[1]];
  }

  $: if ($sOverlay === ov.uid) {
    syncFromOverlay();
  }

  $: if (
    $sOverlay === ov.uid &&
    $sEvent &&
    ['featureUpdated', 'overlayAdjusted'].includes($sEvent.type)
  ) {
    syncFromOverlay();
  }

  const update = throttle((minmax: [number, number]) => {
    dispatch('update', { minmax });
    ov.updateStyleVariables({ min: minmax[0], max: minmax[1] });
  }, 50);

  $: update(minmax);

  const hover = debounce((cm: keyof typeof colorMaps) => {
    ov.setColorMap(cm).catch(handleError);
  }, 200);

  const clampValue = (value: number) => {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, value);
  };
</script>

{#if style === 'quantitative'}
  <Popover.Root>
    <Popover.Trigger
      type="button"
      aria-label="Adjust overlay color map"
      class={classes(
        'size-4 rounded-full border overlay-trigger border-white/30 bg-linear-to-r cursor-pointer opacity-80 transition-opacity hover:opacity-100 focus:ring-1 focus:ring-blue-500',
        colorMapClass[colormap]
      )}
      data-testid="overlay-colormap"
    >
      <span class="sr-only">Adjust overlay color map</span>
    </Popover.Trigger>

    <Popover.Portal>
      <Popover.Content forceMount side="bottom" align="center" sideOffset={8}>
        {#snippet child({ wrapperProps, props, open })}
          {#if open}
            {@const { class: rawContentClass, ...contentRest } = props}
            {@const contentClass: string | undefined =
                typeof rawContentClass === 'string' ? rawContentClass : undefined}
            <div {...wrapperProps}>
              <div
                {...contentRest}
                class={classes(
                  contentClass,
                  'z-50 flex flex-col items-center gap-2 rounded-lg bg-neutral-700/90 p-3 shadow backdrop-blur'
                )}
                on:mouseout={() => hover(colormap)}
                on:blur={() => hover(colormap)}
                transition:scale={{ duration: 120, easing: cubicOut, start: 0.95 }}
              >
                <!-- Color circles -->
                <div class="flex max-w-[16rem] flex-wrap justify-center gap-1">
                  {#each Object.entries(colorMapClass) as [name, cl]}
                    <div
                      class={classes(
                        'h-4 w-4 cursor-pointer rounded-full border border-white/30 bg-linear-to-r',
                        cl,
                        name === colormap && 'ring-2 ring-neutral-200'
                      )}
                      use:tooltip={{ content: name.charAt(0).toUpperCase() + name.slice(1) }}
                      on:click={() => {
                        ov.setColorMap(name).catch(handleError);
                        colormap = name;
                      }}
                      on:mouseover={() => hover(name)}
                      data-testid={`overlay-colormap-option-${name}`}
                    />
                  {/each}
                </div>
                <!-- Minmax -->
                <div class="flex items-center gap-x-2">
                  Min:
                    <DraggableNumber
                      class="block w-12 rounded-lg border border-neutral-400 bg-neutral-700 px-1 py-1 text-center text-sm text-neutral-50 focus:border-blue-500 focus:ring-blue-500"
                      bind:value={minmax[0]}
                      data-testid="overlay-min"
                      on:change={(e) => {
                        const next = clampValue(e.detail ?? minmax[0]);
                        minmax = [next, minmax[1]];
                      }}
                    />
                    Max:
                    <DraggableNumber
                      class="block w-12 rounded-lg border border-neutral-400 bg-neutral-700 px-1 py-1 text-center text-sm text-neutral-50 focus:border-blue-500 focus:ring-blue-500"
                      bind:value={minmax[1]}
                      data-testid="overlay-max"
                      on:change={(e) => {
                        const next = clampValue(e.detail ?? minmax[1]);
                        minmax = [minmax[0], Math.max(next, minmax[0])];
                      }}
                    />
                </div>
                <!-- Auto -->
                <div>
                  <button
                    class="rounded px-2 py-1 bg-cyan-700 transition-colors hover:bg-cyan-600 active:bg-cyan-500"
                    on:click={() => {
                      minmax = [$sFeatureData.minmax[0], $sFeatureData.minmax[1]];
                    }}
                  >
                    Auto
                  </button>
                </div>
              </div>
            </div>
          {/if}
        {/snippet}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
{/if}

<style lang="postcss">
  :global(.overlay-trigger) {
    @apply inline-flex items-center justify-center;
    appearance: none;
    -webkit-appearance: none;
    padding: 0;
    line-height: 1;
    box-sizing: border-box;
  }
</style>
