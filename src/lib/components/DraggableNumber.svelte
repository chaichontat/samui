<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { oneLRU } from '../lru';
  import { tooltip } from '../ui/utils';
  export { cl as class };
  export let value = 0;

  let div: HTMLInputElement;
  let cl = '';
  const dispatch = createEventDispatcher();
  onMount(() => mouseCtrl(div));

  const handleChange = oneLRU((n: number) => {
    dispatch('change', n);
    value = n;
  });

  function scaledIntCtrl(i: number, x: number) {
    const incVal = Math.sign(x) * Math.pow(Math.abs(x) / 10, 1.6);
    const newVal = Math.max(0, i + incVal);
    if (Math.abs(incVal) > 0.3) {
      handleChange(Number(newVal.toPrecision(3)));
    }
  }

  function mouseCtrl(ctrl: HTMLInputElement) {
    let startpos: number;
    let startval: number;
    let currPointer: string;

    ctrl.onmousedown = function (e) {
      startpos = e.clientX;
      startval = parseFloat(ctrl.value);
      if (isNaN(startval)) startval = 0;
      currPointer = document.body.style.cursor;
      document.body.style.setProperty('cursor', 'ew-resize', 'important');

      document.onmousemove = (e) => scaledIntCtrl(startval, Math.ceil(e.clientX - startpos));
      document.onmouseup = () => {
        document.body.style.cursor = currPointer;
        document.onmousemove = null;
      };
    };
  }

  $: console.log(value);
</script>

<input
  class={cl}
  type="number"
  bind:this={div}
  bind:value
  use:tooltip={{ content: 'You can also drag left/right to change' }}
  on:change={(e) => handleChange(Number(e.currentTarget.value))}
  {...$$restProps}
/>

<style lang="postcss">
  /* Remove arrows */
  input[type='number']::-webkit-outer-spin-button,
  input[type='number']::-webkit-inner-spin-button,
  input[type='number'] {
    -webkit-appearance: none;
    -moz-appearance: textfield !important;
  }
</style>
