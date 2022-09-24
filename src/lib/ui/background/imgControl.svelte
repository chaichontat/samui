<script lang="ts">
  import { classes } from '$lib/utils';
  import {
    bgColors,
    colors,
    type BandInfo,
    type ImgCtrl
  } from '$src/lib/ui/background/imgColormap';
  import { zip } from 'lodash-es';
  import { scale } from 'svelte/transition';
  import type { Background } from './imgBackground';

  export let background: Background;
  export let small = false;

  const image = background.image;
  const channels = background.image?.channels;
  const bandinfo: Record<string, BandInfo> = {};
  if (image && Array.isArray(image.channels)) {
    for (const c of image.channels) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      bandinfo[c] = { enabled: false, color: 'blue', max: 128 };
    }
    if (Object.keys(image.defaultChannels).length > 0) {
      for (const [b, c] of Object.entries(image.defaultChannels)) {
        bandinfo[b] = { enabled: true, color: c, max: 128 };
      }
    }
  }

  const imgCtrl: ImgCtrl | undefined =
    image?.channels === 'rgb'
      ? { type: 'rgb', Exposure: 0, Contrast: 0, Saturation: 0 }
      : Array.isArray(image?.channels)
      ? {
          type: 'composite',
          variables: bandinfo
        }
      : undefined;

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

  $: if (imgCtrl) background?.updateStyle(imgCtrl);
</script>

{#if imgCtrl}
  {#if imgCtrl.type === 'composite' && Array.isArray(channels)}
    <!-- w-[1%] is to set cell width to content and not stretch to fit the container. -->

    <table class="table-auto">
      <tbody class="hide-second-col">
        {#each channels as name}
          <tr class="">
            <td class="w-[1%]" on:click={() => handleClick(name, imgCtrl.variables[name].color)}>
              <button
                class={classes(
                  imgCtrl.variables[name].enabled
                    ? bgColors[colors.findIndex((x) => x === imgCtrl.variables[name].color)]
                    : 'opacity-60',
                  imgCtrl.variables[name].enabled &&
                    ['white', 'yellow'].includes(imgCtrl.variables[name].color)
                    ? 'text-black'
                    : '',
                  `transition-width mx-auto my-0.5 flex items-center rounded-full px-3`
                )}
              >
                {name}
              </button>
            </td>

            <td class="flex items-center justify-center gap-x-1.5">
              {#each zip(colors, bgColors) as [color, bg]}
                <button
                  on:click={() => handleClick(name, color)}
                  class={classes(
                    bg,
                    color !== 'white' ? 'opacity-90' : '',
                    `transition-width mx-[1px] my-0.5 flex h-[18px] w-[18px] items-center rounded-full hover:opacity-100`
                  )}
                />
              {/each}
            </td>
            <td>
              <input
                type="range"
                min="0"
                max="254"
                class="ml-4 min-w-[4rem] max-w-[8rem] cursor-pointer"
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

<style lang="postcss">
  .transition-width {
    transition-property: max-width;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 1000ms;
  }

  .hide-second-col td:nth-child(2),
  .hide-second-col td:nth-child(3) {
    @apply hidden;
  }

  .hide-second-col:hover td:nth-child(2) {
    @apply flex;
  }

  .hide-second-col:hover td:nth-child(3) {
    @apply table-cell;
  }
</style>
