<script lang="ts">
  import { sEvent } from '$lib/store';
  import { classes } from '$lib/utils';
  import type { ImgData } from '$src/lib/data/objects/image';
  import {
    bgColors,
    colors,
    type BandInfo,
    type CompCtrl,
    type ImgCtrl
  } from '$src/lib/ui/background/imgColormap';
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

      for (const [chan, color] of zip(image.channels, colors)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        bandinfo[chan!] = { enabled: false, color: color!, minmax: [0, 128] };
      }

      if (Object.keys(image.defaultChannels).length > 0) {
        for (const [c, b] of Object.entries(image.defaultChannels)) {
          if (b) bandinfo[b] = { enabled: true, color: c, minmax: [0, 128] };
        }
      } else {
        bandinfo[image.channels[0]] = { enabled: true, color: 'red', minmax: [0, 128] };
        bandinfo[image.channels[1]] = { enabled: true, color: 'green', minmax: [0, 128] };
        bandinfo[image.channels[2]] = { enabled: true, color: 'blue', minmax: [0, 128] };
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
  onMount(() => {
    table.addEventListener('mouseenter', () => {
      clearTimeout(timeout);
      table.style.maxWidth = '100%';
    });
    table.addEventListener('mouseleave', shrink);
    timeout = setTimeout(shrink, 1500);
  });
</script>

<div
  bind:this={table}
  class="group flex max-w-full flex-col overflow-x-hidden rounded-lg bg-neutral-800/80 px-1 py-1 font-medium ring-4 ring-neutral-800/80 backdrop-blur-lg transition-all duration-1000 ease-in-out"
  class:hidden={!(image && imgCtrl)}
  draggable
  aria-label="Image controls"
>
  {#if image && imgCtrl}
    {#if imgCtrl?.type === 'composite'}
      <table class="table-auto text-sm">
        <tbody>
          <!-- Each channel -->
          {#each image.channels as name}
            <tr aria-label={`${name} controls`} class="">
              <td class="" bind:this={cell}>
                <button
                  class={classes(
                    imgCtrl.variables[name].enabled
                      ? bgColors[colors.findIndex((x) => x === imgCtrl.variables[name].color)] +
                          ' text-white'
                      : 'opacity-80 hover:opacity-100',
                    imgCtrl.variables[name].enabled &&
                      ['white', 'yellow'].includes(imgCtrl.variables[name].color)
                      ? 'text-black'
                      : '',
                    `transition-width mx-auto flex items-center rounded-lg px-2 py-[1px]`
                  )}
                  on:click={() => handleClick(name, imgCtrl.variables[name].color, true)}
                  aria-label="Select channel button"
                >
                  <div class="whitespace-nowrap">{name}</div>
                </button>
              </td>
              <td class="tabular-nums">
                <div class="flex items-center">
                  <div class="min-w-[128px] pl-0.5 cursor-pointer">
                    <RangeSlider
                      min={0}
                      max={255}
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
                    [{imgCtrl.variables[name].minmax}]
                  </span>
                </div>
              </td>
              <td class="flex items-center justify-center gap-x-1.5">
                {#each zip(colors, bgColors) as [color, bg], i}
                  <button
                    on:click={() => handleClick(name, color, true)}
                    class={classes(
                      bg,
                      color !== 'white' ? 'opacity-90' : '',
                      i === 0 ? 'ml-1.5' : '',
                      `mx-[1px] my-1 flex h-[16px] w-[16px] items-center rounded-full opacity-80 transition-opacity duration-500 group-hover:opacity-100`,
                      imgCtrl.variables[name].color === color
                        ? 'ring-2 ring-white ring-opacity-80'
                        : ''
                    )}
                    aria-label={`${color} color button`}
                    data-testid="imgctrl-color-button"
                  />
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
  {/if}
</div>

<style lang="postcss">
  .transition-width {
    transition-property: max-width;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 1000ms;
  }

  :global(.rangeSlider) {
    font-size: 0.6rem; /* default size */
  }
</style>
