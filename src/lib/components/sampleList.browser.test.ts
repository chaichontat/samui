import { page, userEvent } from 'vitest/browser';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import '$src/app.css';
import SampleList from './sampleList.svelte';

test('a long sample list stays within the viewport and scrolls', async () => {
  const samples = Array.from({ length: 40 }, (_, index) => `Sample ${index + 1}`);
  const screen = render(SampleList, {
    props: { items: samples, active: samples[0] }
  });

  await userEvent.click(page.getByTestId('sample-select'));

  const listbox = page.getByRole('listbox');
  await expect.element(listbox).toBeVisible();

  const element = listbox.query();
  if (!(element instanceof HTMLElement)) throw new Error('Sample listbox not mounted');
  await expect
    .poll(() => element.getBoundingClientRect().bottom)
    .toBeLessThanOrEqual(window.innerHeight);
  expect(element.scrollHeight).toBeGreaterThan(element.clientHeight);
  expect(getComputedStyle(element).overflowY).toBe('auto');

  screen.unmount();
});
