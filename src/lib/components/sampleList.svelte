<script lang="ts">
  import { classes } from '$lib/utils';
  import { Check, ChevronUpDown } from '@steeze-ui/heroicons';
  import { Icon } from '@steeze-ui/svelte-icon';
  import { Select } from 'bits-ui';
  import { createEventDispatcher, onMount } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { fly } from 'svelte/transition';
  import Spinner from './spinner.svelte';

  export let items: string[];
  export let active: string;
  export let loading = false;
  export let useSpinner = true;
  export let showArrow = true;

  let lastName: string | undefined;
  let rows: { id: number; name: string }[] = [];
  let selectItems: { value: string; label: string }[] = [];

  const dispatch = createEventDispatcher();

  function handleSampleUpdate(it: typeof items) {
    rows =
      it?.map((item, i) => ({
        id: i,
        name: item
      })) ?? [];
    selectItems = rows.map(({ name }) => ({ value: name, label: name }));
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

  onMount(() => (active = items[0]));
  $: handleChange(active);
  $: handleSampleUpdate(items);
</script>

<div class="relative w-full">
  <span class="inline-block w-full rounded-md shadow-sm" data-testid="sample-select-wrapper">
    <Select.Root type="single" bind:value={active} items={selectItems}>
      <Select.Trigger
        class="relative w-full max-w-md cursor-pointer rounded-md border border-neutral-400 bg-neutral-100/90 py-2 pl-3 pr-10 text-left text-neutral-800 backdrop-blur transition duration-150 ease-in-out focus:border-blue-300 focus:outline-none dark:bg-neutral-800/80 dark:text-neutral-100 sm:leading-5"
        data-testid="sample-select"
      >
        <span class="block truncate font-medium">{active}</span>
        <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          {#if loading}
            <span data-testid="sample-spinner">
              <Spinner />
            </span>
          {:else}
            <Icon
              src={ChevronUpDown}
              class="size-4 stroke-current stroke-2 text-neutral-500 dark:text-neutral-200"
            />
          {/if}
        </span>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content forceMount side="bottom" align="start" sideOffset={4}>
          {#snippet child({ wrapperProps, props, open })}
            {#if open}
              {@const { class: rawContentClass, ...contentRest } = props}
              {@const contentClass: string | undefined =
                typeof rawContentClass === 'string' ? rawContentClass : undefined}
              <div {...wrapperProps}>
                <div
                  {...contentRest}
                  class={classes(
                    contentClass,
                    'bg-default z-40 mt-2 w-full rounded-lg shadow shadow-blue-900 backdrop-blur'
                  )}
                  transition:fly={{ y: 10, duration: 100, easing: cubicOut }}
                >
                  <Select.Viewport
                    class="overflow-auto rounded-lg pt-1 pb-1 leading-6 focus:outline-none sm:leading-5"
                  >
                    {#each rows as { name } (name)}
                      <div class="px-1" data-testid={`sample-option-${name}`}>
                        <Select.Item value={name} label={name}>
                          {#snippet children({ selected, highlighted })}
                            <div
                              class={classes(
                                // 'relative flex w-full items-center gap-2 rounded-lg py-2 pl-3 pr-4'
                                'w-full relative flex items-center cursor-pointer select-none rounded-lg py-2 pl-3 pr-9 focus:outline-none',
                                highlighted ? 'hover-default' : ''
                              )}
                            >
                              <div class={classes(selected ? 'font-semibold' : 'font-normal')}>
                                {name}
                              </div>

                              <div class={classes(selected && showArrow ? '' : 'opacity-0')}>
                                <Icon src={Check} class="size-4 stroke-current stroke-2" />
                              </div>
                            </div>
                          {/snippet}
                        </Select.Item>
                      </div>
                    {/each}
                  </Select.Viewport>
                </div>
              </div>
            {/if}
          {/snippet}
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  </span>
</div>
