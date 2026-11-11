import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import Markdown from './markdown.svelte';

function markdownUrl(text: string) {
  return URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
}

test('drops script URLs from links while keeping external links and code highlighting', async () => {
  const url = markdownUrl(
    [
      '[script](javascript:alert(1)) [mixed](JaVaScRiPt:alert(1))',
      '',
      '[site](https://example.com) [mail](mailto:a@example.com) [local](./notes.md)',
      '',
      '```python',
      'x = 1',
      '```'
    ].join('\n')
  );
  const screen = render(Markdown, { props: { url } });

  await expect.poll(() => screen.container.querySelectorAll('a').length).toBe(5);
  const hrefs = Object.fromEntries(
    Array.from(screen.container.querySelectorAll('a'), (a) => [
      a.textContent,
      a.getAttribute('href')
    ])
  );
  expect(hrefs.script).toBeNull();
  expect(hrefs.mixed).toBeNull();
  expect(hrefs.site).toBe('https://example.com');
  expect(hrefs.mail).toBe('mailto:a@example.com');
  expect(hrefs.local).toBe('./notes.md');
  expect(screen.container.querySelector('a[href="https://example.com"]')?.getAttribute('rel')).toBe(
    'nofollow'
  );
  expect(screen.container.querySelector('code.hljs .hljs-number')).not.toBeNull();

  screen.unmount();
  URL.revokeObjectURL(url);
});
