<script lang="ts">
  import { zip } from 'lodash-es';
  import { scale } from 'svelte/transition';
  import { classes } from '../utils';
  import { bgColors, colors, type BandInfo, type ImageCtrl } from './imgControl';

  export let defaultChannels: Record<string, BandInfo['color']> = {};
  export let channels: string[] | 'rgb' | null = null;
  export let small = false;

  let names = channels;

  const selected: Record<string, BandInfo> = {};
  if (Array.isArray(channels)) {
    for (const c of channels) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      selected[c] = { enabled: false, color: 'blue', max: 128 };
    }
    if (Object.keys(defaultChannels).length > 0) {
      for (const [b, c] of Object.entries(defaultChannels)) {
        selected[b] = { enabled: true, color: c, max: 128 };
      }
    }
  }

  const _ic: ImageCtrl =
    channels === 'rgb'
      ? { type: 'rgb', Exposure: 0, Contrast: 0, Saturation: 0 }
      : {
          type: 'composite',
          variables: selected
        };

  export let imgCtrl: ImageCtrl = _ic;
  imgCtrl = _ic; // Override from upstream.

  function handleClick(name: string, color: BandInfo['color'] | undefined) {
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
</script>

{#if imgCtrl}
  {#if imgCtrl.type === 'composite' && Array.isArray(names)}
    <!-- w-[1%] is to set cell width to content and not stretch to fit the container. -->
    <table class="min-w-[400px] table-auto border-separate border-spacing-x-2">
      <tbody>
        {#each names as name}
          {#key name}
            <tr class="">
              {#each zip(colors, bgColors) as [color, bg]}
                <td class="w-[1%]" on:click={() => handleClick(name, color)}>
                  <button
                    class={classes(
                      imgCtrl.variables[name].color === color ? 'max-w-[1000px]' : 'max-w-[20px]',
                      imgCtrl.variables[name].color === color && !imgCtrl.variables[name].enabled
                        ? 'bg-gray-700'
                        : bg,
                      `transition-width mx-auto flex h-5 w-auto min-w-[20px] items-center rounded-full px-2 text-sm hover:opacity-100`
                    )}
                  >
                    {#if imgCtrl.variables[name].color === color}
                      <div
                        class="-translate-y-[1px]"
                        class:text-black={color === 'white'}
                        class:text-gray-300={!imgCtrl.variables[name].enabled}
                        in:scale={{ delay: 100, duration: 100 }}
                        out:scale={{ delay: 400, duration: 500 }}
                      >
                        {name}
                      </div>
                    {/if}
                  </button>
                </td>
              {/each}
              <td class="w-full" />
              <td>
                <input
                  type="range"
                  min="0"
                  max="254"
                  class="ml-1 min-w-[4rem] max-w-[8rem] cursor-pointer"
                  bind:value={imgCtrl.variables[name].max}
                />
              </td>
            </tr>
          {/key}
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
</style>
