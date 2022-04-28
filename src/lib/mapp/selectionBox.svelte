<script lang="ts">
  import { Popover, PopoverButton, PopoverPanel } from '@rgossiaux/svelte-headlessui';
  import { createEventDispatcher } from 'svelte';

  export let names: string[] = ['dd', 'fdf'];
  export let hovering: string = names[0];

  const dispatch = createEventDispatcher();
</script>

<Popover class="relative">
  <PopoverButton
    class="rounded-md bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:text-opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75"
  >
    <slot name="button">
      <div class="flex items-center">
        Selections
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          class="ml-2 h-5 w-5 text-sky-300 transition duration-150 ease-in-out group-hover:text-opacity-80"
          ><path
            fill-rule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clip-rule="evenodd"
          />
        </svg>
      </div>
    </slot>
  </PopoverButton>

  <PopoverPanel
    class="picker absolute right-0 z-20 mt-3 min-w-[200px] gap-y-1 divide-y divide-gray-500 px-0.5 py-0.5 text-sm xl:text-base"
  >
    <section class="mt-1 p-1 px-4">
      {#if names.length === 0}
        <span class="italic text-slate-300"> No selections. </span>
      {/if}
      {#each names as name, i}
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-x-2">
            <button>
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
            <span class="text-ellipsis">{name.length > 0 ? name : `Selection ${i + 1}`}</span>
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

    <section class="p-1">
      {#if names.length > 0}
        <div class="picker-el py-1">Export selections</div>
        <div class="picker-el py-1">Export selected spots</div>
        <div class="picker-el py-1">Clear all</div>
      {:else}
        <div class="picker-el py-1">Import selections</div>
      {/if}
    </section>
  </PopoverPanel>
</Popover>

<style lang="postcss">
  section {
    @apply flex flex-col gap-y-1 py-1;
  }
</style>
