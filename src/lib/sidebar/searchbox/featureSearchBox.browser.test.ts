import { page, userEvent } from 'vitest/browser';
import { afterEach, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import '$src/app.css';
import FeatureSearchBox from './featureSearchBox.svelte';

afterEach(() => page.viewport(414, 896));

test('a long feature-group list stays within a short viewport and the last group remains selectable', async () => {
  await page.viewport(414, 320);
  const featureGroup = Array.from({ length: 40 }, (_, index) => ({
    group: `Group ${index + 1}`,
    features: [`Feature ${index + 1}`]
  }));
  const screen = render(FeatureSearchBox, { props: { featureGroup } });

  await userEvent.click(page.getByTestId('feature-search-group'));

  const listbox = page.getByRole('listbox');
  await expect.element(listbox).toBeVisible();

  const element = listbox.query();
  if (!(element instanceof HTMLElement)) throw new Error('Feature-group listbox not mounted');

  await expect
    .poll(() => {
      const { top, bottom } = element.getBoundingClientRect();
      return top >= 0 && bottom <= window.innerHeight;
    })
    .toBe(true);
  expect(element.scrollHeight).toBeGreaterThan(element.clientHeight);
  expect(getComputedStyle(element).overflowY).toBe('auto');

  element.scrollTop = element.scrollHeight;
  const lastOption = page.getByText('Group 40', { exact: true });
  await expect
    .poll(() => {
      const option = lastOption.query()?.getBoundingClientRect();
      const bounds = element.getBoundingClientRect();
      return option !== undefined && option.top >= bounds.top && option.bottom <= bounds.bottom;
    })
    .toBe(true);

  await userEvent.click(lastOption);
  const trigger = page.getByTestId('feature-search-group');
  await expect.element(trigger).toHaveTextContent('Group 40');
  await expect.element(trigger).toHaveAttribute('aria-expanded', 'false');

  screen.unmount();
});
