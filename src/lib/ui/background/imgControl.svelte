<script lang="ts">
  import { sEvent } from '$lib/store';
  import { classes, cn } from '$lib/utils';
  import { LiquidGlassIsland } from '$src/lib/components/liquid-glass';
  import type { ImgData } from '$src/lib/data/objects/image';
  import {
    bgColors,
    colors,
    type BandInfo,
    type CompCtrl,
    type ImgCtrl
  } from '$src/lib/ui/background/imgColormap';
  import { ArrowRight } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { isEqual, zip } from 'lodash-es';
  import { onMount } from 'svelte';
  import RangeSlider from 'svelte-range-slider-pips';
  import type { Background } from './imgBackground';

  export let background: Background;
  export let small = false;

  let table: HTMLDivElement;
  let cell: HTMLTableCellElement;

  let imgCtrl: ImgCtrl | undefined;
  let image: ImgData | undefined;
  let expanded = false;

  const bandinfo: Record<string, BandInfo> = {};

  // imgCtrl is a global variable.
  function initialSet(): ImgCtrl | undefined {
    image = background.image;
    if (!image) return undefined;

    if (image.channels === 'rgb') {
      imgCtrl = { type: 'rgb', Exposure: 0, Contrast: 0, Saturation: 0 };
    } else if (Array.isArray(image.channels)) {
      const ls = localStorage.getItem('imgCtrl');
      if (ls) {
        const toVerify = JSON.parse(ls) as CompCtrl;
        if (toVerify.variables && isEqual(Object.keys(toVerify.variables), image.channels)) {
          imgCtrl = toVerify;
        }
      }

      const half = Math.round(image.maxVal / 2);

      const nColorRatio = image.channels.length / colors.length;
      // Repeat colors to match the number of channels
      const repeated = new Array(Math.ceil(nColorRatio) * colors.length).fill(colors).flat();
      const logHalf = Math.sqrt(half);
      for (const [chan, color] of zip(image.channels, repeated)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        bandinfo[chan!] = { enabled: false, color: color!, minmax: [0, logHalf] };
      }

      if (Object.keys(image.defaultChannels).length > 0) {
        for (const [c, b] of Object.entries(image.defaultChannels)) {
          if (b) bandinfo[b] = { enabled: true, color: c, minmax: [0, logHalf] };
        }
      } else {
        bandinfo[image.channels[0]] = { enabled: true, color: 'red', minmax: [0, logHalf] };
        bandinfo[image.channels[1]] = { enabled: true, color: 'green', minmax: [0, logHalf] };
        bandinfo[image.channels[2]] = { enabled: true, color: 'blue', minmax: [0, logHalf] };
      }

      imgCtrl = {
        type: 'composite',
        variables: bandinfo
      };
    } else {
      throw new Error('Invalid channels');
    }
  }

  function handleClick(name: string, color: BandInfo['color'] | undefined, alternate = false) {
    if (!imgCtrl) return;
    if (imgCtrl.type === 'composite' && color) {
      (document.querySelector(`#slider-${name}`) as HTMLElement | null)?.style.setProperty(
        '--range-handle',
        color
      );
      (document.querySelector(`#slider-${name}`) as HTMLElement | null)?.style.setProperty(
        '--range-handle-focus',
        color
      );
      const v = imgCtrl.variables[name];
      if (v.enabled && v.color === color && alternate) {
        imgCtrl.variables[name].enabled = false;
      } else {
        const dupe = Object.values(imgCtrl.variables).find((v) => v.color === color && v.enabled);
        if (dupe) dupe.enabled = false;
        imgCtrl.variables[name].enabled = true;
        imgCtrl.variables[name].color = color;
      }
    }
  }

  $: if ($sEvent?.type === 'sampleUpdated') initialSet();
  $: if (imgCtrl) s();
  const s = () => background?.updateStyle(imgCtrl!);

  const shrink = () => table && (table.style.maxWidth = `${cell.clientWidth + 8}px`);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  // onMount(() => {
  //   table.addEventListener('mouseenter', () => {
  //     clearTimeout(timeout);
  //     table.style.maxWidth = '100%';
  //   });
  //   table.addEventListener('mouseleave', shrink);
  //   timeout = setTimeout(shrink, 1500);
  // });

  $: console.log(expanded);
  $: maxNameWidth = 80;
  $: if (table && imgCtrl) {
    const buttonCells = document?.querySelectorAll(
      'td[aria-label="button-cell"]'
    ) as NodeListOf<HTMLTableCellElement>;
    if (buttonCells) {
      const maxWidth = Math.max(...Array.from(buttonCells).map((cell) => cell.clientWidth));
      maxNameWidth = maxWidth;
      console.log('Max button cell width:', maxWidth);
    }
  }
</script>

<!-- bind:this={table} -->
<!-- class:hidden={!(image && imgCtrl)} -->
<!-- draggable -->

<LiquidGlassIsland
  baseHeight={250}
  baseWidth={maxNameWidth + 11}
  expandWidthRatio={455 / (maxNameWidth + 11)}
  bind:expanded
  class="relative group overflow-x-hidden pl-1.5 pr-2 py-2 font-medium"
  aria-label="Image controls"
  on:requestState={(e) => (expanded = e.detail.expanded)}
>
  {#if image && imgCtrl}
    {#if imgCtrl?.type === 'composite'}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <table
        class="table-auto text-sm w-[380px]"
        on:click={(e) => e.stopPropagation()}
        bind:this={table}
      >
        <tbody>
          <!-- Each channel -->
          {#each image.channels as name}
            <tr aria-label={`${name} controls`} class="">
              <td
                class="flex justify-center -translate-y-[1.5px]"
                bind:this={cell}
                aria-label="button-cell"
              >
                <button
                  class="max-w-[120px]"
                  on:click={() => handleClick(name, imgCtrl.variables[name].color, true)}
                  aria-label="Select channel button"
                >
                  <div
                    class={classes(
                      imgCtrl.variables[name].enabled
                        ? bgColors[colors.findIndex((x) => x === imgCtrl.variables[name].color)] +
                            ' text-white'
                        : 'opacity-80 hover:opacity-100',
                      imgCtrl.variables[name].enabled &&
                        ['white', 'yellow'].includes(imgCtrl.variables[name].color)
                        ? 'text-black'
                        : '',
                      `rounded-lg px-2 py-[1px] w-fit max-w-[100px]`
                    )}
                  >
                    <div class="truncate" aria-label="Channel name">
                      {name}
                    </div>
                  </div>
                </button>
              </td>
              <td class="tabular-nums">
                <div class="flex items-center">
                  <div class="min-w-[128px] pl-0.5 cursor-pointer">
                    <RangeSlider
                      min={0}
                      max={Math.sqrt(image.maxVal)}
                      step={0.1}
                      range
                      springValues={{ stiffness: 1, damping: 1 }}
                      on:start={() => handleClick(name, imgCtrl.variables[name].color)}
                      bind:values={imgCtrl.variables[name].minmax}
                      id={`slider-${name}`}
                    />
                  </div>
                  <span
                    class={classes(
                      imgCtrl.variables[name].enabled ? '' : 'opacity-80 hover:opacity-100',
                      'whitespace-nowrap'
                    )}
                    aria-label="Max channel intensity"
                  >
                    [{imgCtrl.variables[name].minmax.map((x) => Math.round(x ** 2))}]
                  </span>
                </div>
              </td>
              <td class="flex items-center justify-center gap-x-1.5 ml-1">
                {#each zip(colors, bgColors) as [color, bg], i}
                  <button
                    on:click={() => handleClick(name, color, true)}
                    class={cn(
                      bg,
                      color !== 'white' ? 'opacity-90' : '',
                      i === 0 ? 'ml-2' : '',
                      `mx-[1px] my-1 flex size-4 rounded-full transition-opacity duration-500 translate-y-[1.5px]`,
                      imgCtrl.variables[name].color === color ? 'ring-2 ring-white opacity-100' : ''
                    )}
                    aria-label={`${color} color button`}
                    data-testid="imgctrl-color-button"
                  ></button>
                {/each}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else if imgCtrl.type === 'rgb'}
      <div class="grid grid-cols-3 gap-y-1.5 gap-x-1">
        {#each ['Exposure', 'Contrast', 'Saturation'] as name}
          <div class="px-1">{small ? name.slice(0, 3) : name}:</div>
          <input
            type="range"
            min="-0.5"
            step="0.01"
            max="0.5"
            bind:value={imgCtrl[name]}
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
      <div class="bg-gray-600/30 animate-pulse rounded-lg px-2 w-[70px] h-[18px] py-2"></div>
      <div class="bg-gray-600/30 animate-pulse rounded-lg px-2 w-[70px] h-[18px] py-2"></div>
      <div class="bg-gray-600/30 animate-pulse rounded-lg px-2 w-[70px] h-[18px] py-2"></div>
    </div>
  {/if}

  <!-- <button class="absolute top-1/2">
    <div
      class="absolute left-[80px] w-0 h-0 border-l-[6px] border-b-[6px] border-l-transparent border-b-gray-300"
    ></div> -->

  <!-- <Icon class="size-3 stroke-[2]" /> -->
</LiquidGlassIsland>

<style lang="postcss">
  :global(.rangeSlider) {
    font-size: 0.6rem; /* default size */
  }
</style>
