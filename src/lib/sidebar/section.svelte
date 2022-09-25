<script lang="ts">
  import { Disclosure, DisclosureButton, DisclosurePanel } from '@rgossiaux/svelte-headlessui';
  import { slide } from 'svelte/transition';
  import { classes } from '../utils';

  let cl = '';
  export { cl as class };
  export let title: string;
  export let defaultOpen = false;
</script>

<section class="w-full">
  <Disclosure let:open {defaultOpen}>
    <DisclosureButton
      class={classes(
        open ? 'rounded-b-none' : 'delay-150',
        'flex w-full items-center justify-between rounded-lg bg-white/5 py-2 pl-[13px] pr-4 text-left font-medium transition-[border-radius] ease-in-out hover:bg-white/10 focus:outline-none'
      )}
    >
      <div class="font-xl">{title}</div>
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
    </DisclosureButton>

    {#if open}
      <div class="rounded-b-lg bg-slate-800" transition:slide>
        <DisclosurePanel class="px-[13px] py-2" static>
          <div class={cl}>
            <slot>
              <div class="text-slate-100">No content</div>
            </slot>
          </div>
        </DisclosurePanel>
      </div>
    {/if}
  </Disclosure>
</section>
