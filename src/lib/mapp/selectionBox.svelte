<script lang="ts">
  import { Popover, PopoverButton, PopoverPanel, Transition } from '@rgossiaux/svelte-headlessui';
  import { createEventDispatcher } from 'svelte';

  export let names: string[] = ['dd', 'fdf'];
  const dispatch = createEventDispatcher();
</script>

<Popover class="relative z-20">
  <PopoverButton
    class="rounded-md bg-sky-600/80 px-3 py-2 text-sm font-medium text-white backdrop-blur transition-all hover:bg-sky-600/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 active:bg-sky-500 dark:bg-sky-700/80 dark:text-sky-50 dark:hover:bg-sky-700 dark:active:bg-sky-600"
  >
    <slot name="button">
      <div class="flex items-center">
        Selections
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          class="ml-2 h-5 w-5 transition duration-150 ease-in-out"
          ><path
            fill-rule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clip-rule="evenodd"
          />
        </svg>
      </div>
    </slot>
  </PopoverButton>
  <Transition
    enter="transition duration-100 ease-out"
    enterFrom="transform scale-95 opacity-0"
    enterTo="transform scale-100 opacity-100"
    leave="transition duration-75 ease-out"
    leaveFrom="transform scale-100 opacity-100"
    leaveTo="transform scale-95 opacity-0"
  >
    <PopoverPanel
      class="picker absolute right-0 z-20 mt-3 min-w-[200px] gap-y-1 divide-y divide-gray-500 px-0.5 py-0.5 text-sm xl:text-base"
    >
      <section class="mt-1 p-1 px-4">
        {#if names.length === 0}
          <span class="italic text-slate-300"> No selections. </span>
        {/if}

        {#each names as name, i}
          <div
            class="flex items-center justify-between"
            on:mouseenter={() => dispatch('hover', { i })}
            on:mouseleave={() => dispatch('hover', { i: null })}
          >
            <div class="flex items-center gap-x-2">
              <button on:click={() => dispatch('rename', { i })}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4 stroke-current stroke-2 transition-all hover:stroke-[3]"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>
              <span class="text-ellipsis">{name}</span>
            </div>

            <button on:click={() => dispatch('delete', { i })}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 stroke-current stroke-2 transition-all hover:stroke-[3]"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        {/each}
      </section>

      <section id="selectionControls" class="p-1">
        <input
          class="visually-hidden"
          name="file"
          type="file"
          id="selectionFileInput"
          accept=".json"
          on:click={(e) => (e.currentTarget.value = '')}
          on:change={(e) => dispatch('import', { e })}
        />
        <label for="selectionFileInput" class="picker-el w-full py-1 text-left">
          Import selections
        </label>
        {#if names.length > 0}
          <button
            class="picker-el py-1 text-left"
            on:click={() => dispatch('export', { name: 'selections' })}>Export selections</button
          >
          <button
            class="picker-el py-1 text-left"
            on:click={() => dispatch('export', { name: 'spots' })}>Export spots</button
          >
          <button class="picker-el py-1 text-left" on:click={() => dispatch('clearall')}
            >Clear all</button
          >
        {/if}
      </section>
    </PopoverPanel>
  </Transition>
</Popover>

<style lang="postcss">
  section {
    @apply flex flex-col gap-y-1 py-1;
  }

  .visually-hidden {
    @apply absolute overflow-hidden;
    height: 1px;
    width: 1px;
    clip: rect(1px, 1px, 1px, 1px);
  }
</style>
