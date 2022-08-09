<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const id = `input-${Math.random().toString(16).slice(2)}`;
  const dispatch = createEventDispatcher();
  export let accept = '.json';
</script>

<input
  class="visually-hidden"
  name="file"
  type="file"
  {accept}
  {id}
  on:click={(e) => (e.currentTarget.value = '')}
  on:change={(e) => dispatch('import', { e })}
/>

<label for={id}><slot /></label>

<style lang="postcss">
  .visually-hidden {
    @apply absolute overflow-hidden;
    height: 1px;
    width: 1px;
    clip: rect(1px, 1px, 1px, 1px);
  }
</style>
