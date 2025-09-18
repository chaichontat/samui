<script lang="ts">
  import 'highlight.js/styles/github-dark.css';
  import { onDestroy } from 'svelte';
  import { cn } from '../utils';
  import { highlightCode } from './codeHighlight';

  /** Source code to render. */
  export let code = '';
  /** Highlight.js language key (e.g. 'python', 'typescript'). */
  export let language: string | undefined = undefined;
  /** Render inline code instead of a block. */
  export let inline = false;
  /** Allow soft wrapping inside the block. */
  export let wrap = false;
  /** Accessible label for screen readers. */
  export let ariaLabel = 'Code snippet';
  /** Additional classes for the container or inline element. */
  export let className = '';
  /** Show a copy-to-clipboard control for block snippets. */
  export let showCopy = false;

  let codeElement: HTMLElement | null = null;
  let copied = false;
  let resetTimer: ReturnType<typeof setTimeout> | null = null;

  async function handleCopy() {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      copied = true;

      if (resetTimer) {
        clearTimeout(resetTimer);
      }

      resetTimer = setTimeout(() => {
        copied = false;
        resetTimer = null;
      }, 1500);
    } catch (error) {
      // Clipboard write failed; leave the UI unchanged to avoid misleading feedback.
      console.error('Failed to copy code snippet', error);
    }
  }

  onDestroy(() => {
    if (resetTimer) {
      clearTimeout(resetTimer);
    }
  });

  $: {
    if (typeof window === 'undefined' || !codeElement) {
      // SSR or element not yet mounted: skip highlighting.
    } else {
      code;
      language;
      highlightCode({ element: codeElement, code, language });
    }
  }
</script>

{#if inline}
  <code bind:this={codeElement} class={cn('hljs', className)} aria-label={ariaLabel}></code>
{:else}
  <div class="relative">
    {#if showCopy}
      <button
        class="absolute right-1 top-2 rounded-md border border-neutral-700 bg-black/60 px-2 py-1 text-xs font-medium text-neutral-100 transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 opacity-75 hover:opacity-100"
        data-testid="copy-code-button"
        on:click={handleCopy}
        type="button"
      >
        {#if copied}
          Copied
        {:else}
          Copy
        {/if}
      </button>
      <span class="sr-only" aria-live="polite">{copied ? 'Copied to clipboard' : ''}</span>
    {/if}
    <pre
      class={`hljs ${wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre overflow-x-auto'} ${className}`.trim()}
      aria-label={ariaLabel}>
      <code bind:this={codeElement}></code></pre>
  </div>
{/if}

<style>
  .hljs {
    background: transparent !important;
    padding: 0 !important;
  }
</style>
