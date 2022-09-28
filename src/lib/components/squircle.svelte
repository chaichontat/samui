<!-- https://svelte.dev/repl/20501ea52b894167be8ab8cae47ea4b0?version=3.31.2 -->
<script lang="ts">
  export { cl as class };
  export let roundness = 1.3;

  export let fill = '#47556988';
  export let width = 160;
  export let height = width;

  export let div;
  let cl = '';
  let path = '';
  let svg = '';
  let bg = '';

  $: bg = `background-image: url("data:image/svg+xml;utf8,${svg}"); background-size: cover;`;

  $: svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'>
        <path d='${path}' style='fill: ${fill};'></path>
        </svg>`
    .replace(/#/g, '%23')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
    .replace(/\n/g, '');

  $: {
    let w = width;
    let h = height;
    let wm = w * (h / w);
    let ro = roundness < 0 ? 0 : roundness > 3.8 ? 3.8 : roundness;
    let r = -(w / 20) + (w / 10) * (ro - 1);
    path = `
        M ${w / 2},0
        C ${r},0        0,${r}        0,${wm / 2}
          0,${wm - r}     ${r},${wm}    ${w / 2},${wm}
          ${w - r},${wm}  ${w},${wm - r}  ${w},${wm / 2}
          ${w},${r}     ${w - r},0      ${w / 2},0
      `;
    path = path.replace(/  +/g, ' ').replace(/\n/gi, '');
  }
</script>

<div bind:this={div} class={cl} style={bg + `width: ${width}px; height: ${height}px;`}>
  Hi
  <slot />
</div>

<style lang="postcss">
  .squircle {
    position: relative;
    width: auto;
    height: auto;
    padding-top: 100%;
  }
  .squircle-content {
    position: absolute;
    display: flex;
    justify-content: center;
    align-items: center;
    text-align: center;
    left: 0;
    top: 0;
    bottom: 0;
    right: 0;
  }
</style>
