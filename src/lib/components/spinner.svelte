<script lang="ts">
  export let color = '#f1f5f9';
  export let unit = 'px';
  export let duration = '1.25s';
  export let size = '16';
</script>

<div
  class="circle z-50 mr-1"
  style="--size: {size}{unit}; --color: {color}; --duration: {duration}"
/>

<style>
  .circle {
    height: var(--size);
    width: var(--size);
    border-color: var(--color) transparent var(--color) var(--color);
    border-width: calc(var(--size) / 10);
    border-style: solid;
    border-image: initial;
    border-radius: 50%;
    animation: var(--duration) linear 0s infinite normal none running rotate;
  }
  @keyframes rotate {
    0% {
      transform: rotate(0);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
