import hljs from 'highlight.js/lib/common';

export type HighlightOptions = {
  element: HTMLElement;
  code: string;
  language?: string;
};

export function highlightCode({ element, code, language }: HighlightOptions): void {
  const trimmed = language?.trim().toLowerCase();

  if (!code) {
    element.textContent = '';
    return;
  }

  if (trimmed && hljs.getLanguage(trimmed)) {
    element.textContent = code;
    try {
      hljs.highlightElement(element);
      return;
    } catch (error) {
      console.error('Highlight.js failed with the provided language', error);
    }
  }

  const { value, language: inferred } = hljs.highlightAuto(code);
  element.innerHTML = value;
  if (inferred) {
    element.dataset.language = inferred;
  }
}
