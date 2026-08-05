import { page, userEvent } from 'vitest/browser';
import { afterEach, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import '$src/app.css';
import SampleList from './sampleList.svelte';

afterEach(() => page.viewport(414, 896));

test('a long sample list stays within a short viewport and the last sample remains selectable', async () => {
  await page.viewport(414, 320);
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
    .poll(() => {
      const { top, bottom } = element.getBoundingClientRect();
      return top >= 0 && bottom <= window.innerHeight;
    })
    .toBe(true);
  expect(element.scrollHeight).toBeGreaterThan(element.clientHeight);
  expect(getComputedStyle(element).overflowY).toBe('auto');

  element.scrollTop = element.scrollHeight;
  const lastOption = page.getByTestId('sample-option-Sample 40');
  await expect
    .poll(() => {
      const option = lastOption.query()?.getBoundingClientRect();
      const bounds = element.getBoundingClientRect();
      return option !== undefined && option.top >= bounds.top && option.bottom <= bounds.bottom;
    })
    .toBe(true);

  await userEvent.click(lastOption);
  const trigger = page.getByTestId('sample-select');
  await expect.element(trigger).toHaveTextContent('Sample 40');
  await expect.element(trigger).toHaveAttribute('aria-expanded', 'false');

  screen.unmount();
});
