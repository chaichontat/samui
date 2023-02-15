<script lang="ts">
  import rehypeExternalLinks from 'rehype-external-links';
  import rehypeHighlight from 'rehype-highlight';
  import rehypeStringify from 'rehype-stringify';
  import remarkGfm from 'remark-gfm';
  import remarkParse from 'remark-parse';
  import remarkRehype from 'remark-rehype';
  import { onMount } from 'svelte';
  import { unified } from 'unified';
  import { handleError } from '../utils';

  let cl = 'text-sm overflow-x-scroll pl-4 -indent-4';
  export { cl as class };

  export let url: string;
  let div: HTMLDivElement;

  onMount(async () => {
    const res = await fetch(url).catch(handleError);
    const text = await res.text();
    const file = await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeHighlight)
      .use(rehypeExternalLinks)
      .use(rehypeStringify)
      .process(text);

    div.innerHTML = String(file);
  });
</script>

<div class="relative">
  <div class={cl} bind:this={div} />
</div>

<style lang="postcss">
  div :global(a) {
    @apply text-blue-300 underline active:text-blue-400;
  }

  div :global(a:visited) {
    @apply text-purple-500;
  }

  div :global(.hljs-number) {
    @apply text-cyan-300;
  }
</style>
