<script lang="ts">
  type Color = 'blue' | 'green' | 'red' | 'slate';
  export let names: string[];
  export let color: Color;
  export let curr: string;

  function genClass(c: Color, active: boolean) {
    switch (c) {
      case 'blue':
        return `border-blue-700/50 ${
          active
            ? 'bg-blue-700 hover:bg-blue-600'
            : 'bg-blue-900/50 hover:bg-blue-800 active:bg-blue-700'
        }`;
      case 'green':
        return `border-green-700/50 ${
          active
            ? 'bg-green-700 hover:bg-green-700'
            : 'bg-green-900/50 hover:bg-green-800 active:bg-green-700'
        }`;
      case 'red':
        return `border-red-700/50 ${
          active
            ? 'bg-red-800 hover:bg-red-700 active:bg-red-600'
            : 'bg-red-900/50 hover:bg-red-800 active:bg-red-700'
        }`;
      case 'slate':
        return `border-slate-500/50 ${
          active
            ? 'bg-slate-700 hover:bg-slate-700'
            : 'bg-slate-900/50 hover:bg-slate-800 active:bg-slate-700'
        }`;

      default:
        throw 'Incorrect color';
    }
  }
</script>

<div class="inline-flex flex-wrap rounded-md shadow-sm" id="group" role="group">
  <button
    on:click={() => (curr = names[0])}
    class={`${genClass(color, curr === names[0])} button-base rounded-l-lg border`}
    >{names[0]}</button
  >

  {#each names.slice(1, -1) as pro}
    <button
      on:click={() => (curr = pro)}
      class={`${genClass(color, curr === pro)} button-base border-t border-b border-r`}
      >{pro}</button
    >
  {/each}

  <button
    on:click={() => (curr = names[names.length - 1])}
    class={`${genClass(
      color,
      curr === names[names.length - 1]
    )} button-base rounded-r-lg border-t border-b border-r`}
    >{names[names.length - 1]}
  </button>
</div>
