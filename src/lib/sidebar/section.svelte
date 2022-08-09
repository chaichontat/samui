<script lang="ts">
  import { Disclosure, DisclosureButton, DisclosurePanel } from '@rgossiaux/svelte-headlessui';

  export let title: string;
</script>

<section class="w-full">
  <Disclosure let:open class="">
    <DisclosureButton
      class="flex w-full items-center justify-between rounded-lg bg-white/10 py-2 pl-3 pr-4 text-left font-medium hover:bg-white/20 focus:outline-none"
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

    <DisclosurePanel class="mx-3 mt-2">
      <slot />
    </DisclosurePanel>
  </Disclosure>
</section>
