<script lang="ts">
  type Color = 'blue' | 'green' | 'red' | 'slate';
  export let names: string[];
  export let color: Color;
  export let curr: string;

  function genClass(c: Color, active: boolean) {
    switch (c) {
      case 'blue':
        return `border-gray-400 dark:border-blue-700/50 ${
          active
            ? 'bg-blue-600 dark:bg-blue-700 dark:hover:bg-blue-600'
            : 'bg-gray-200/30 text-gray-600 dark:text-gray-100 dark:bg-blue-900/50 dark:hover:bg-blue-800 dark:active:bg-blue-700'
        }`;
      case 'green':
        return `border-gray-400 dark:border-green-700/50 ${
          active
            ? 'bg-green-600 dark:bg-green-700 dark:hover:bg-green-700'
            : 'bg-gray-200/30 text-gray-600 dark:text-gray-100 dark:bg-green-900/50 dark:hover:bg-green-800 dark:active:bg-green-700'
        }`;
      case 'red':
        return `border-gray-400 dark:border-red-700/50 ${
          active
            ? 'bg-red-700 dark:hover:bg-red-700 dark:active:bg-red-600'
            : 'bg-gray-200/30 text-gray-600 dark:text-gray-100 dark:bg-red-900/50 dark:hover:bg-red-800 dark:active:bg-red-700'
        }`;
      case 'slate':
        return `border-gray-400 dark:border-slate-500/50 ${
          active
            ? 'bg-slate-700 dark:hover:bg-slate-700'
            : 'bg-slate-300 text-gray-500 dark:text-gray-100 dark:bg-slate-900/50 dark:hover:bg-slate-800 dark:active:bg-slate-700'
        }`;

      default:
        throw 'Incorrect color';
    }
  }
</script>

<div class="inline-flex rounded-md shadow-sm" id="group" role="group">
  <button
    on:click={() => (curr = names[0])}
    class={`${genClass(color, curr === names[0])} button-base rounded-l-lg border `}
    >{names[0]}</button
  >

  {#each names.slice(1) as pro}
    <button
      on:click={() => (curr = pro)}
      class={`${genClass(color, curr === pro)} button-base border-t border-b border-r`}
      >{pro}</button
    >
  {/each}

  <button
    on:click={() => (curr = 'none')}
    class={`${genClass(
      color,
      curr === 'none'
    )} button-base rounded-r-lg border-t border-b border-r`}
    >None
  </button>
</div>
