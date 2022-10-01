<script lang="ts">
  import { classes } from '$lib/utils';
  import {
    Listbox,
    ListboxButton,
    ListboxOption,
    ListboxOptions
  } from '@rgossiaux/svelte-headlessui';
  import { Check, ChevronUpDown } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { createEventDispatcher, onMount } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { fade } from 'svelte/transition';
  import Spinner from './spinner.svelte';

  export let items: string[];
  export let active: string;
  export let loading = false;
  export let useSpinner = true;
  export let showArrow = true;
  export let addSample = true;

  let lastName: string | undefined;

  let rows: { id: number; name: string }[] = [];
  let _active: { id: number; name: string };

  const dispatch = createEventDispatcher();

  function handleSampleUpdate(it: typeof items) {
    rows = it?.sort().map((item, i) => ({
      id: i,
      name: item
    }));
  }

  export function stopSpinner() {
    loading = false;
  }

  function handleChange(name: string) {
    if (name === 'addSample') {
      dispatch('addSample');
      return;
    }

    if (name !== lastName) {
      dispatch('change', name);
      active = name;
      if (useSpinner) loading = true;
    }
    lastName = name;
  }

  onMount(() => handleChange(items[0]));

  $: handleSampleUpdate(items);
  $: _active = rows.find((r) => r.name === active)!;
  $: if (!active) active = items[0];
</script>

<div class="relative w-full">
  <span class="inline-block w-full rounded-md shadow-sm">
    <Listbox value={_active} on:change={(e) => handleChange(e.detail.name ?? e.detail)} let:open>
      <ListboxButton
        class="relative w-full max-w-md cursor-pointer rounded-md border border-neutral-400 bg-neutral-100/90 py-2 pl-3 pr-10 text-left text-neutral-800 backdrop-blur transition duration-150 ease-in-out focus:border-blue-300 focus:outline-none dark:bg-neutral-800/80 dark:text-neutral-100 sm:leading-5"
      >
        <span class="block truncate font-medium">{_active?.name}</span>
        <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          {#if loading}
            <Spinner />
          {:else}
            <Icon
              src={ChevronUpDown}
              class="h-5 w-5 stroke-current stroke-2 text-neutral-500 dark:text-neutral-200"
            />
          {/if}
        </span>
      </ListboxButton>

      {#if open}
        <div
          class="bg-default absolute z-40 mt-2 w-full rounded-lg shadow shadow-blue-900 backdrop-blur "
          out:fade={{ duration: 100, easing: cubicOut }}
        >
          <ListboxOptions
            static
            class="overflow-auto rounded-lg pt-1 pb-1 leading-6 focus:outline-none sm:leading-5"
          >
            {#each rows as name (name)}
              <div class="px-1">
                <ListboxOption
                  value={name}
                  class={({ active }) => {
                    return classes(
                      'relative cursor-pointer select-none rounded-lg py-2 pl-3 pr-9 focus:outline-none',
                      active ? 'hover-default' : ''
                    );
                  }}
                  let:active
                  let:selected
                >
                  <span class={classes(selected ? 'font-semibold' : 'font-normal')}>
                    {name.name}
                  </span>
                  {#if selected && showArrow}
                    <span
                      class={classes(
                        'absolute inset-y-0 right-0 flex items-center pr-4',
                        active ? '' : ''
                      )}
                    >
                      <Icon src={Check} class="h-5 w-5 stroke-current stroke-2" />
                    </span>
                  {/if}
                </ListboxOption>
              </div>
            {/each}

            <!-- {#if addSample}
              <div class="mt-1 border-t border-neutral-500 px-1 pt-1">
                <ListboxOption
                  value="addSample"
                  class="hover-default relative cursor-pointer select-none rounded py-2 pl-3 pr-9 italic focus:outline-none"
                >
                  Add Sample
                </ListboxOption>
              </div>
            {/if} -->
          </ListboxOptions>
        </div>
      {/if}
    </Listbox>
  </span>
</div>
