<script lang="ts">
  import {
    Listbox,
    ListboxButton,
    ListboxOption,
    ListboxOptions
  } from '@rgossiaux/svelte-headlessui';
  import { createEventDispatcher } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { fade } from 'svelte/transition';

  export let items: string[];
  let rows: { id: number; name: string }[] = [];

  const dispatch = createEventDispatcher();

  $: rows = items?.sort().map((item, i) => ({
    id: i,
    name: item
  }));

  $: active = rows[0];
  function classNames(...classes: (false | null | undefined | string)[]): string {
    return classes.filter(Boolean).join(' ');
  }
</script>

<div class="relative min-w-[150px] max-w-lg md:min-w-[200px]">
  <span class="inline-block w-full rounded-md shadow-sm">
    <Listbox
      value={active}
      on:change={(e) => {
        active = e.detail;
        dispatch('change', e.detail.name);
      }}
      let:open
    >
      <ListboxButton
        class="relative w-full max-w-md cursor-pointer rounded-md border border-gray-600 bg-gray-800 py-2 pl-3 pr-10 text-left transition duration-150 ease-in-out focus:border-blue-300 focus:outline-none sm:leading-5"
      >
        <span class="block truncate font-medium">{active?.name}</span>
        <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <svg class="h-5 w-5 text-slate-200" viewBox="0 0 20 20" fill="none" stroke="currentColor">
            <path
              d="M7 7l3-3 3 3m0 6l-3 3-3-3"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span></ListboxButton
      >
      {#if open}
        <div
          class="absolute mt-2 w-full rounded-md bg-gray-800/80 backdrop-blur"
          out:fade={{ duration: 100, easing: cubicOut }}
        >
          <ListboxOptions
            static
            class="overflow-auto rounded-md pt-1 pb-2 leading-6 shadow focus:outline-none sm:leading-5"
          >
            {#each rows as name (name)}
              <div class="px-2">
                <ListboxOption
                  value={name}
                  class={({ active }) => {
                    return classNames(
                      'relative cursor-pointer select-none rounded py-2 pl-3 pr-9 focus:outline-none',
                      active ? 'bg-gray-600 text-white' : ''
                    );
                  }}
                  let:active
                  let:selected
                >
                  <span
                    class={classNames('block truncate', selected ? 'font-semibold' : 'font-normal')}
                  >
                    {name.name}
                  </span>
                  {#if selected}
                    <span
                      class={classNames(
                        'absolute inset-y-0 right-0 flex items-center pr-4',
                        active ? 'text-white' : 'text-gray-200'
                      )}
                    >
                      <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fill-rule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clip-rule="evenodd"
                        />
                      </svg>
                    </span>
                  {/if}
                </ListboxOption>
              </div>
            {/each}
          </ListboxOptions>
        </div>
      {/if}
    </Listbox>
  </span>
</div>
