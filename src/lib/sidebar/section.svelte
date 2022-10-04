<script lang="ts">
  import {
    Disclosure,
    DisclosureButton,
    DisclosurePanel,
    Switch
  } from '@rgossiaux/svelte-headlessui';
  import { ChevronDown } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';
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
</script>

<section class="w-full" use:tooltip={{ enabled: Boolean(tooltipMsg), content: tooltipMsg }}>
  <Disclosure let:open {defaultOpen}>
    <DisclosureButton
      class={classes(
        // open ? 'rounded-b-none' : 'delay-150',
        'flex w-full items-center justify-between py-2 pl-3 pr-4 text-left font-medium text-neutral-300 transition-[border-radius] ease-in-out hover:bg-white/10 focus:outline-none'
      )}
    >
      <div class="text-sm">{title}</div>

      <div class="flex items-center gap-x-3">
        {#if togglable}
          <Switch
            as="button"
            checked={toggled}
            on:change={(e) => (toggled = e.detail)}
            on:click={(e) => e.stopPropagation()}
            class={classes(
              'focus:shadow-outline relative inline-flex h-6 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent shadow-white transition-colors duration-200 ease-in-out focus:outline-none',
              toggled ? 'bg-blue-700' : 'bg-neutral-600'
            )}
            let:checked
          >
            <span
              class={classes(
                'inline-block h-[18px] w-[18px] translate-y-[1px] transform rounded-full bg-neutral-200 transition duration-200 ease-in-out',
                checked ? 'translate-x-6' : 'translate-x-0.5'
              )}
            />
          </Switch>
        {/if}
        <Icon
          src={ChevronDown}
          class={classes(
            `svg-icon h-4 w-4 stroke-current stroke-[3] transition-transform delay-100 duration-300 ease-in-out`,
            open ? 'rotate-180' : ''
          )}
        />
      </div>
    </DisclosureButton>

    {#if open}
      <div transition:slide>
        <DisclosurePanel
          class="overflow-visible bg-neutral-800 px-[12px] pt-2 pb-[8px] text-[13px] shadow-inner shadow-neutral-900/30"
          static
        >
          <div class={classes(cl, togglable && !toggled ? toggledOff : '')}>
            <slot {toggled}>
              <div class="text-neutral-100">No content</div>
            </slot>
          </div>
        </DisclosurePanel>
      </div>
    {/if}
  </Disclosure>
</section>
