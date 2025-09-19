<script lang="ts">
  import { sEvent } from '$lib/store';
  import GlassIsland from '$src/lib/components/glass/GlassIsland.svelte';
  import type { ImgData } from '$src/lib/data/objects/image';
  import {
    type BandInfo,
    type CompCtrl,
    type ImgCtrl,
    type RGBCtrl
  } from '$src/lib/ui/background/imgColormap';
  import {
    buildCompositeController,
    buildRgbController,
    cloneController,
    selectChannelColor
  } from '$src/lib/ui/background/imgControlState';
  import { Tooltip } from 'bits-ui';
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import CompositeChannelTable from './CompositeChannelTable.svelte';
  import type { Background } from './imgBackground';

  let {
    background,
    small = false
  }: {
    background: Background;
    small?: boolean;
  } = $props();

  const COLLAPSE_DELAY_MS = 3000;

  let image = $state<ImgData | undefined>(undefined);
  let controller = $state<ImgCtrl | undefined>(undefined);
  let expanded = $state(false);
  let maxNameWidth = $state(80);

  let compositeController = $state<CompCtrl | undefined>(undefined);
  let rgbController = $state<RGBCtrl | undefined>(undefined);

  let mounted = false;
  let mountTimestamp = 0;
  let collapseTimer: ReturnType<typeof setTimeout> | null = null;
  let collapseInitiated = $state(false);

  function initialiseController(): void {
    const nextImage = background.image;
    image = nextImage;

    if (!nextImage) {
      controller = undefined;
      return;
    }

    if (nextImage.channels === 'rgb') {
      controller = buildRgbController();
    } else if (Array.isArray(nextImage.channels)) {
      controller = buildCompositeController(nextImage);
    } else {
      throw new Error('Invalid channel configuration');
    }

    collapseInitiated = false;
  }

  const clearCollapseTimer = (resetInitiated = true) => {
    if (collapseTimer) {
      clearTimeout(collapseTimer);
      collapseTimer = null;
    }
    if (resetInitiated) {
      collapseInitiated = false;
    }
  };

  const scheduleCollapse = () => {
    if (!mounted || collapseInitiated) return;

    clearCollapseTimer(false);
    collapseInitiated = true;
    collapseTimer = setTimeout(() => {
      expanded = false;
      collapseTimer = null;
      collapseInitiated = false;
    }, COLLAPSE_DELAY_MS);
  };

  const applyChannelSelection = (
    channel: string,
    color: BandInfo['color'] | undefined,
    allowToggleOff = false
  ) => {
    selectChannelColor(controller, channel, color, allowToggleOff);
  };

  const handleInteraction = (event?: Event) => {
    if (event && event.isTrusted === false) return;
    if (typeof performance !== 'undefined' && performance.now() - mountTimestamp < 50) {
      return;
    }
    clearCollapseTimer();
  };

  const controllerSnapshot = $derived.by(() => cloneController(controller));

  const sampleEvent = $derived($sEvent?.type);

  $effect(() => {
    if (sampleEvent === 'sampleUpdated') {
      initialiseController();
    }
  });

  $effect(() => {
    const ctrl = controller;
    if (!ctrl) {
      compositeController = undefined;
      rgbController = undefined;
      return;
    }

    if (ctrl.type === 'composite') {
      compositeController = ctrl;
      rgbController = undefined;
    } else if (ctrl.type === 'rgb') {
      rgbController = ctrl;
      compositeController = undefined;
    } else {
      compositeController = undefined;
      rgbController = undefined;
    }
  });

  $effect(() => {
    if (!controllerSnapshot) return;
    background?.updateStyle(controllerSnapshot);
  });

  $effect(() => {
    const ctrl = controller;
    if (!mounted || !ctrl || collapseInitiated || !expanded) return;
    scheduleCollapse();
  });

  onMount(() => {
    mounted = true;
    mountTimestamp = typeof performance !== 'undefined' ? performance.now() : 0;
    expanded = true;
    initialiseController();

    return () => {
      clearCollapseTimer();
      mounted = false;
      collapseInitiated = false;
    };
  });
</script>

<Tooltip.Provider delayDuration={!expanded ? 700 : 1500}>
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <GlassIsland
          baseHeight={250}
          baseWidth={maxNameWidth + 11}
          expandWidthRatio={450 / (maxNameWidth + 11)}
          bind:expanded
          class="relative group overflow-x-hidden pl-1.5 pr-2 py-2 font-medium"
          aria-label="Image controls"
          onRequestState={(detail) => (expanded = detail.expanded)}
          onmouseenter={handleInteraction}
          onmousedown={handleInteraction}
          {...props}
        >
          {#if image && controller}
            {#if compositeController}
              <CompositeChannelTable
                {image}
                controller={compositeController}
                onSelect={applyChannelSelection}
                onRequestExpand={() => (expanded = true)}
                bind:maxNameWidth
              />
            {:else if rgbController}
              <div class="grid grid-cols-3 gap-y-1.5 gap-x-1">
                {#each ['Exposure', 'Contrast', 'Saturation'] as name (name)}
                  {@const key = name as keyof RGBCtrl}
                  <div class="px-1">{small ? name.slice(0, 3) : name}:</div>
                  <input
                    type="range"
                    min="-0.5"
                    step="0.01"
                    max="0.5"
                    bind:value={rgbController[key]}
                    class="col-span-2 min-w-[4rem] max-w-[12rem] cursor-pointer"
                    aria-label={`${name} slider`}
                  />
                {/each}
              </div>
            {:else}
              <div>This should never show up.</div>
            {/if}
          {:else}
            <div class="flex flex-col gap-1.5 my-1.5 ml-1">
              {#each Array.from({ length: 3 }) as _, i (i)}
                <div class="flex gap-x-2">
                  <div
                    class="bg-gray-600/30 animate-pulse rounded-lg px-2 w-[80px] h-[18px] py-2"
                  ></div>
                  <div
                    class="bg-gray-600/30 animate-pulse rounded-lg px-2 w-[150px] h-[18px] py-2 ml-1"
                  ></div>
                  <div class="flex gap-x-1">
                    {#each Array.from({ length: 7 }) as _, j (j)}
                      <div
                        class="rounded-full bg-gray-600/30 animate-pulse size-[18px] mx-[1px] inline-block"
                      ></div>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </GlassIsland>
      {/snippet}
    </Tooltip.Trigger>

    <Tooltip.Content side="right" align="start" sideOffset={8} forceMount>
      {#snippet child({ props, wrapperProps, open })}
        {#if open}
          <div {...wrapperProps}>
            <div
              class="rounded-md bg-gray-800/50 px-3 py-1 text-xs font-medium text-white shadow-lg"
              transition:fly
              {...props}
            >
              Click the corners to {expanded ? 'collapse' : 'expand'}
            </div>
          </div>
        {/if}
      {/snippet}
    </Tooltip.Content>
  </Tooltip.Root>
</Tooltip.Provider>

<style lang="postcss">
  @reference "$css"
  .transition-width {
    transition-property: max-width;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 1000ms;
  }
</style>
