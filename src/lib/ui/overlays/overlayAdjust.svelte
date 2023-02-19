<script lang="ts">
  import { sEvent } from '$lib/store';
  import type { colorMaps } from '$lib/ui/overlays/featureColormap';
  import DraggableNumber from '$src/lib/components/DraggableNumber.svelte';
  import { sFeatureData } from '$src/lib/store';
  import { classes } from '$src/lib/utils';
  import { Popover, PopoverButton, PopoverPanel, Transition } from '@rgossiaux/svelte-headlessui';
  import { throttle } from 'lodash-es';
  import { createEventDispatcher } from 'svelte';
  import { tooltip } from '../utils';
  import type { WebGLSpots } from './points';

  export let ov: WebGLSpots;
  let minmax: [number, number] = [0, 0];
  let colormap: keyof typeof colorMaps = 'viridis';
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

  $: if (minmax[0] === 0 && minmax[1] === 0 && $sFeatureData) {
    minmax = [$sFeatureData.minmax[0], $sFeatureData.minmax[1]];
  }

  const update = throttle((minmax: [number, number]) => {
    dispatch('update', { minmax });
    ov.updateStyleVariables({ min: minmax[0], max: minmax[1] });
  }, 50);

  $: update(minmax);
</script>

{#if ov.currStyle === 'quantitative'}
  <Popover class="relative">
    <PopoverButton>
      <div
        class={classes(
          'h-4 w-4 rounded-full border border-white/30 bg-gradient-to-r cursor-pointer opacity-80 hover:opacity-100 transition-opacity focus:ring-1 focus:ring-blue-500',
          colorMapClass[colormap]
        )}
      />
    </PopoverButton>
    <Transition
      enter="transition duration-100 ease-out"
      enterFrom="transform scale-95 opacity-0"
      enterTo="transform scale-100 opacity-100"
      leave="transition duration-75 ease-out"
      leaveFrom="transform scale-100 opacity-100"
      leaveTo="transform scale-95 opacity-0"
    >
      <PopoverPanel class="absolute z-10">
        <div
          class="flex flex-col items-center bg-neutral-700/90 backdrop-blur p-3 rounded-lg mt-2 shadow -translate-x-1/2 gap-2"
        >
          <!-- Color circles -->
          <div class="flex flex-wrap max-w-[16rem] justify-center gap-1">
            {#each Object.entries(colorMapClass) as [name, cl]}
              <div
                class={classes(
                  'h-4 w-4 rounded-full border border-white/30 bg-gradient-to-r cursor-pointer',
                  cl,
                  name === colormap && 'ring-2 ring-neutral-200'
                )}
                use:tooltip={{ content: name.charAt(0).toUpperCase() + name.slice(1) }}
                on:click={() => {
                  ov.setColorMap(name);
                  colormap = name;
                }}
              />
            {/each}
          </div>
          <!-- Minmax -->
          <div class="flex items-center gap-x-2">
            Min:
            <DraggableNumber
              class="border text-center text-sm rounded-lg block w-12 px-1 py-1 bg-neutral-700 border-neutral-400 text-neutral-50 focus:ring-blue-500 focus:border-blue-500"
              bind:value={minmax[0]}
            />
            Max:
            <DraggableNumber
              class="border text-center text-sm rounded-lg block w-12 px-1 py-1 bg-neutral-700 border-neutral-400 text-neutral-50 focus:ring-blue-500 focus:border-blue-500"
              bind:value={minmax[1]}
            />
          </div>
          <!-- Auto -->
          <div>
            <button
              class="bg-cyan-700 hover:bg-cyan-600 active:bg-cyan-500 rounded px-2 py-1 transition-colors"
              on:click={() => {
                minmax = [$sFeatureData.minmax[0], $sFeatureData.minmax[1]];
              }}
            >
              Auto
            </button>
          </div>
        </div>
      </PopoverPanel>
    </Transition>
  </Popover>
{/if}
