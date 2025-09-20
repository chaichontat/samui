<script lang="ts">
  import { flashing } from '$lib/store';
  import { ChevronDown } from '@lucide/svelte';
  import { Collapsible, Switch } from 'bits-ui';
  import { cubicOut } from 'svelte/easing';
  import { slide } from 'svelte/transition';
  import { tooltip } from '../ui/utils';
  import { classes } from '../utils';

  let cl = '';
  export { cl as class };
  export let title: string;
  export let defaultOpen = false;
  export let togglable = false;
  export let toggled = false;
  export let toggledOff = 'opacity-50 pointer-events-none';
  export let tooltipMsg = '';

  let interval: ReturnType<typeof setInterval>;
  let isOpen = defaultOpen;
  let prevDefaultOpen = defaultOpen;

  function flash(element: HTMLElement) {
    interval = setInterval(() => {
      requestAnimationFrame(() => {
        element.style.transition = 'none';
        element.style.color = 'rgba(255,62,0,1)';
        element.style.backgroundColor = 'rgba(255,62,0,0.2)';

        setTimeout(() => {
          element.style.transition = 'color 1s, background 1s';
          element.style.color = '';
          element.style.backgroundColor = '';
        });
      });
    }, 1000);
  }
  let div: HTMLElement;

  $: if ($flashing === title) {
    flash(div);
  } else {
    clearInterval(interval);
  }

  $: if (defaultOpen !== prevDefaultOpen) {
    isOpen = defaultOpen;
    prevDefaultOpen = defaultOpen;
  }
</script>

<section
  {title}
  class="w-full"
  data-test-id={`sidebar-section-${title}`}
  use:tooltip={{ enabled: Boolean(tooltipMsg), content: tooltipMsg }}
  bind:this={div}
  on:click={() => ($flashing === title ? ($flashing = '') : '')}
>
  <Collapsible.Root bind:open={isOpen}>
    <Collapsible.Trigger
      type="button"
      class={classes(
        'flex w-full items-center justify-between py-2 pl-3 pr-4 text-left font-medium text-neutral-300 transition-[border-radius] ease-in-out hover:bg-white/10 focus:outline-none'
      )}
    >
      <div class="text-sm">{title}</div>

      <div class="flex items-center gap-x-3">
        {#if togglable}
          <Switch.Root bind:checked={toggled}>
            {#snippet child({ props, checked })}
              {@const { class: switchClass, ...switchRest } = props}
              <button
                {...switchRest}
                class={classes(
                  typeof switchClass === 'string' ? switchClass : undefined,
                  'focus:shadow-outline relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent shadow-white transition-colors duration-200 ease-in-out focus:outline-none',
                  checked ? 'bg-blue-700' : 'bg-neutral-600'
                )}
                type="button"
                on:click|stopPropagation
              >
                <span
                  class={classes(
                    'inline-block h-[18px] w-[18px] translate-y-px transform rounded-full bg-neutral-200 transition duration-200 ease-out',
                    checked ? 'translate-x-6' : 'translate-x-0.5'
                  )}
                />
              </button>
            {/snippet}
          </Switch.Root>
        {/if}
        <ChevronDown
          class={classes(
            `svg-icon size-3.5 stroke-current stroke-[2.5px] transition-transform duration-250 ease-out`,
            isOpen ? 'rotate-180' : ''
          )}
        />
      </div>
    </Collapsible.Trigger>

    <Collapsible.Content forceMount>
      {#snippet child({ props, open })}
        {#if open}
          {@const { class: rawContentClass, ...contentRest } = props}
          {@const contentClass: string | undefined =
            typeof rawContentClass === 'string' ? rawContentClass : undefined}
          <div
            {...contentRest}
            class={classes(
              contentClass,
              'overflow-visible bg-neutral-800 px-[12px] pt-2 pb-[8px] text-[13px] shadow-inner shadow-neutral-900/30'
            )}
            transition:slide={{ duration: 200, easing: cubicOut }}
          >
            <div class={classes(cl, togglable && !toggled ? toggledOff : '')}>
              <slot {toggled}>
                <div class="text-neutral-100">No content</div>
              </slot>
            </div>
          </div>
        {/if}
      {/snippet}
    </Collapsible.Content>
  </Collapsible.Root>
</section>
