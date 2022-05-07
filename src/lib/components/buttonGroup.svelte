<script lang="ts">
  import { classes, tooltip } from '$lib/utils';
  import { createEventDispatcher } from 'svelte';

  type Color = 'blue' | 'green' | 'red' | 'slate';
  export let names: string[];
  export let color: Color;
  export let curr: string | null = null;
  export let addNone = true;
  export let small = false;

  let namesAdded: string[];
  $: {
    namesAdded = [...names];
    if (addNone) namesAdded.push('None');
    if (namesAdded.length < 2) {
      throw new Error('names must have at least two elements');
    }
  }

  const dispatch = createEventDispatcher();

  function genClass(c: Color, active: boolean) {
    switch (c) {
      case 'blue':
        return `border-blue-400 dark:border-blue-700/50 ${
          active
            ? 'bg-blue-600 dark:bg-blue-700 dark:hover:bg-blue-600'
            : 'bg-slate-200/30 text-slate-600 dark:text-slate-100 dark:bg-blue-900/50 dark:hover:bg-blue-800 dark:active:bg-blue-700'
        }`;
      case 'green':
        return `border-green-400 dark:border-green-700/50 ${
          active
            ? 'bg-green-600 dark:bg-green-700 dark:hover:bg-green-700'
            : 'bg-slate-200/30 text-slate-600 dark:text-slate-100 dark:bg-green-900/50 dark:hover:bg-green-800 dark:active:bg-green-700'
        }`;
      case 'red':
        return `border-red-400 dark:border-red-700/50 ${
          active
            ? 'bg-red-700 dark:hover:bg-red-700 dark:active:bg-red-600'
            : 'bg-slate-200/30 text-slate-600 dark:text-slate-100 dark:bg-red-900/50 dark:hover:bg-red-800 dark:active:bg-red-700'
        }`;
      case 'slate':
        return `border-slate-400 dark:border-slate-500/50 ${
          active
            ? 'bg-slate-700 dark:hover:bg-slate-700'
            : 'bg-slate-300 text-slate-500 dark:text-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-800 dark:active:bg-slate-700'
        }`;

      default:
        throw 'Incorrect color';
    }
  }
</script>

<div class="inline-flex rounded-md shadow-sm">
  {#each namesAdded as n, i}
    <button
      on:click={() => {
        curr = n;
        dispatch('change', { value: n });
      }}
      class={classes(genClass(color, curr === n), 'button-base border-t border-b border-r')}
      class:border-l={i === 0}
      class:rounded-l-lg={i === 0}
      class:rounded-r-lg={i === namesAdded.length - 1}
      use:tooltip={{ content: n, enabled: small }}
    >
      {small ? n.slice(0, 2) : n}
    </button>
  {/each}
</div>
