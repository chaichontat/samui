<script lang="ts">
  import {
    Disclosure,
    DisclosureButton,
    DisclosurePanel,
    Switch
  } from '@rgossiaux/svelte-headlessui';
  import { slide } from 'svelte/transition';
  import { classes } from '../utils';

  let cl = '';
  export { cl as class };
  export let title: string;
  export let defaultOpen = false;
  export let togglable = false;
  let toggled: boolean = false;
  export let toggledOff = 'opacity-50 pointer-events-none';
</script>

<section class="w-full">
  <Disclosure let:open {defaultOpen}>
    <DisclosureButton
      class={classes(
        open ? 'rounded-b-none' : 'delay-150',
        'flex w-full items-center justify-between rounded-lg bg-white/[8%] py-2 pl-[13px] pr-4 text-left font-medium transition-[border-radius] ease-in-out hover:bg-white/10 focus:outline-none'
      )}
    >
      <div class="text-mb">{title}</div>

      <div class="flex items-center gap-x-3">
        {#if togglable}
          <Switch
            as="button"
            checked={toggled}
            on:change={(e) => (toggled = e.detail)}
            on:click={(e) => e.stopPropagation()}
            class={classes(
              'focus:shadow-outline relative inline-flex h-6 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent shadow-white transition-colors duration-200 ease-in-out focus:outline-none',
              toggled ? 'bg-blue-600' : 'bg-slate-500'
            )}
            let:checked
          >
            <span
              class={classes(
                'inline-block h-[18px] w-[18px] translate-y-[1px] transform rounded-full bg-slate-200 transition duration-200 ease-in-out',
                checked ? 'translate-x-6' : 'translate-x-0.5'
              )}
            />
          </Switch>
        {/if}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4 stroke-current"
          class:rotate-180={open}
          fill="none"
          stroke-width="3"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </DisclosureButton>

    {#if open}
      <div class="rounded-b-lg bg-white/[15%]" transition:slide>
        <DisclosurePanel class="px-[13px] py-2 text-sm" static>
          <div class={classes(cl, togglable && !toggled ? toggledOff : '')}>
            <slot {toggled}>
              <div class="text-slate-100">No content</div>
            </slot>
          </div>
        </DisclosurePanel>
      </div>
    {/if}
  </Disclosure>
</section>
