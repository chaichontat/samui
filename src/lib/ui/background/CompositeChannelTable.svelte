<script lang="ts">
  import { classes, cn } from '$lib/utils';
  import type { ImgData } from '$src/lib/data/objects/image';
  import { bgColors, colors, type CompCtrl } from '$src/lib/ui/background/imgColormap';
  import { zip } from 'lodash-es';
  import RangeSlider from 'svelte-range-slider-pips';

  let {
    image,
    controller,
    onSelect,
    onRequestExpand,
    maxNameWidth = $bindable(80)
  }: {
    image: ImgData;
    controller: CompCtrl;
    onSelect: (
      channel: string,
      color: CompCtrl['variables'][string]['color'],
      allowToggle?: boolean
    ) => void;
    onRequestExpand: () => void;
    maxNameWidth?: number;
  } = $props();

  let table = $state<HTMLTableElement | null>(null);

  const measure = () => {
    if (!table) {
      maxNameWidth = 80;
      return;
    }
    const buttonCells = table.querySelectorAll<HTMLTableCellElement>(
      'td[aria-label="button-cell"]'
    );
    if (!buttonCells.length) {
      maxNameWidth = 80;
      return;
    }
    const width = Math.max(...Array.from(buttonCells, (cell) => cell.clientWidth));
    if (Number.isFinite(width)) {
      maxNameWidth = width;
    }
  };

  $effect(() => {
    measure();
    if (!table || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(table);
    return () => observer.disconnect();
  });

  $effect(() => {
    if (typeof document === 'undefined') return;
    for (const [channel, band] of Object.entries(controller.variables)) {
      const slider = document.getElementById(`slider-${channel}`);
      if (!(slider instanceof HTMLElement)) continue;
      slider.style.setProperty('--range-handle', band.color);
      slider.style.setProperty('--range-handle-focus', band.color);
    }
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<table
  data-lgis-stop-toggle
  class="table-auto text-sm w-[380px]"
  onclick={(event: MouseEvent) => {
    event.stopPropagation();
    event.stopImmediatePropagation();
    event.preventDefault();
  }}
  bind:this={table}
>
  <tbody>
    {#each image.channels as name, i (i)}
      {@const band = controller.variables[name]}
      {#if band}
        {@const colorIndex = colors.findIndex((color) => color === band.color)}
        <tr aria-label={`${name} controls`}>
          <td
            class="flex justify-center min-w-[70px] -translate-y-[1.5px] relative"
            aria-label="button-cell"
          >
            <button
              class="max-w-[120px]"
              onclick={() => onSelect(name, band.color, true)}
              aria-label="Select channel button"
            >
              <div
                class={classes(
                  band.enabled
                    ? `${colorIndex >= 0 ? bgColors[colorIndex] : ''} text-white`
                    : 'opacity-80 hover:opacity-100',
                  band.enabled && ['white', 'yellow'].includes(band.color) ? 'text-black' : '',
                  'rounded-lg px-2 py-[1px] w-fit max-w-[100px]'
                )}
              >
                <div class="truncate" aria-label="Channel name">{name}</div>
              </div>
            </button>
            <button
              class="h-full w-2 absolute -right-1"
              aria-label="Expand controls"
              onclick={onRequestExpand}
            ></button>
          </td>
          <td class="tabular-nums">
            <div class="flex items-center">
              <div class="min-w-[128px] pl-1 cursor-pointer">
                <RangeSlider
                  min={0}
                  max={Math.sqrt(image.maxVal)}
                  step={0.1}
                  range
                  springValues={{ stiffness: 1, damping: 1 }}
                  on:start={() => onSelect(name, band.color)}
                  bind:values={band.minmax}
                  id={`slider-${name}`}
                />
              </div>
              <span
                class={classes(
                  band.enabled ? '' : 'opacity-80 hover:opacity-100',
                  'whitespace-nowrap'
                )}
                aria-label="Max channel intensity"
              >
                [{band.minmax.map((value: number) => Math.round(value ** 2))}]
              </span>
            </div>
          </td>
          <td class="flex items-center justify-center gap-x-1.5 ml-1">
            {#each zip(colors, bgColors) as [color, bg], index (index)}
              <button
                onclick={() => onSelect(name, color, true)}
                class={cn(
                  bg,
                  color !== 'white' ? 'opacity-90' : '',
                  index === 0 ? 'ml-2' : '',
                  'mx-[1px] my-1 flex size-4 rounded-full transition-opacity duration-500 translate-y-[1.5px]',
                  band.color === color ? 'ring-2 ring-white opacity-100' : ''
                )}
                aria-label={`${color} color button`}
                data-testid="imgctrl-color-button"
              ></button>
            {/each}
          </td>
        </tr>
      {/if}
    {/each}
  </tbody>
</table>

<style>
  :global(.rangeSlider) {
    font-size: 0.6rem; /* default size */
  }
</style>
