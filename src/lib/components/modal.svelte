<script>
  import { Dialog, DialogOverlay, Transition } from '@rgossiaux/svelte-headlessui';
  export let isOpen = false;
</script>

<Transition
  show={isOpen}
  enter="transition duration-100 ease-out"
  enterFrom="transform scale-95 opacity-0"
  enterTo="transform scale-100 opacity-100"
  leave="transition duration-75 ease-out"
  leaveFrom="transform scale-100 opacity-100"
  leaveTo="transform scale-95 opacity-0"
>
  <Dialog open={isOpen} on:close={() => (isOpen = false)}>
    <DialogOverlay class="fixed top-0 left-0 bg-black/30" />
    <div
      class="my-8 inline-block w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all"
    >
      <slot />
      <button on:click={() => (isOpen = false)}>Close</button>
    </div>
  </Dialog>
</Transition>
