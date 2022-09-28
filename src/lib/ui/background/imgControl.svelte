<script lang="ts">
  import { sEvent } from '$lib/store';
  import { classes } from '$lib/utils';
  import type { ImgData } from '$src/lib/data/objects/image';
  import {
    bgColors,
    colors,
    type BandInfo,
    type ImgCtrl
  } from '$src/lib/ui/background/imgColormap';
  import { zip } from 'lodash-es';
  import { onMount } from 'svelte';
  import type { Background } from './imgBackground';

  export let background: Background;
  export let small = false;

  let table: HTMLDivElement;
  let cell: HTMLTableCellElement;

  let imgCtrl: ImgCtrl | undefined;
  let image: ImgData | undefined;

  const bandinfo: Record<string, BandInfo> = {};
  $: channels = image?.channels;

  function setColors() {
    image = background.image;
    if (!image) return { image: undefined, imgCtrl: undefined };

    if (image.channels === 'rgb') {
      imgCtrl = { type: 'rgb', Exposure: 0, Contrast: 0, Saturation: 0 };
    } else if (Array.isArray(image.channels)) {
      for (const c of image.channels) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        bandinfo[c] = { enabled: false, color: 'blue', max: 128 };
      }

      if (Object.keys(image.defaultChannels).length > 0) {
        for (const [c, b] of Object.entries(image.defaultChannels)) {
          if (b) bandinfo[b] = { enabled: true, color: c, max: 128 };
        }
      }
      imgCtrl = {
        type: 'composite',
        variables: bandinfo
      };
    } else {
      throw new Error('Invalid channels');
    }
    console.debug('Set colors', imgCtrl);
    return { image, imgCtrl };
  }

  function handleClick(name: string, color: BandInfo['color'] | undefined) {
    if (!imgCtrl) return;
    if (imgCtrl.type === 'composite' && color) {
      const v = imgCtrl.variables[name];
      if (v.enabled && v.color === color) {
        imgCtrl.variables[name].enabled = false;
      } else {
        const dupe = Object.values(imgCtrl.variables).find((v) => v.color === color && v.enabled);
        if (dupe) dupe.enabled = false;
        imgCtrl.variables[name].enabled = true;
        imgCtrl.variables[name].color = color;
      }
    }
  }

  $: if ($sEvent?.type === 'sampleUpdated') ({ imgCtrl, image } = setColors());
  $: if (imgCtrl) background?.updateStyle(imgCtrl);

  const shrink = () => table && (table.style.maxWidth = `${cell.clientWidth + 8}px`);

  onMount(() => {
    table.addEventListener('mouseenter', () => (table.style.maxWidth = '2000px'));
    table.addEventListener('mouseleave', shrink);
    setTimeout(shrink, 1500);
  });
</script>

<div
  bind:this={table}
  class="group flex max-w-[1000px] flex-col overflow-x-hidden rounded-lg bg-slate-200/80 bg-opacity-80 px-1 py-1 font-medium ring-4 ring-slate-800/80 backdrop-blur-lg transition-all duration-1000 ease-in-out dark:bg-slate-800/80"
  class:hidden={!(image && imgCtrl)}
>
  {#if image && imgCtrl}
    {#if imgCtrl.type === 'composite' && Array.isArray(channels)}
      <table class="table-auto text-sm">
        <tbody>
          <!-- Each channel -->
          {#each channels as name}
            <tr class="">
              <td
                class=""
                on:click={() => handleClick(name, imgCtrl.variables[name].color)}
                bind:this={cell}
              >
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
                >
                  <div>{name}</div>
                </button>
              </td>

              <td class="flex items-center justify-center gap-x-1.5">
                {#each zip(colors, bgColors) as [color, bg], i}
                  <button
                    on:click={() => handleClick(name, color)}
                    class={classes(
                      bg,
                      color !== 'white' ? 'opacity-90' : '',
                      i === 0 ? 'ml-1.5' : '',
                      `mx-[1px] my-1 flex h-[16px] w-[16px] items-center rounded-full opacity-80 transition-opacity duration-500 group-hover:opacity-100`
                    )}
                  />
                {/each}
              </td>
              <td>
                <input
                  type="range"
                  min="0"
                  max="254"
                  class="mx-4 min-w-[4rem] max-w-[8rem] cursor-pointer opacity-70 transition-opacity duration-500 group-hover:opacity-100"
                  bind:value={imgCtrl.variables[name].max}
                />
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
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
          />
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style lang="postcss">
  .transition-width {
    transition-property: max-width;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 1000ms;
  }
</style>
