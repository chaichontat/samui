import { page, userEvent } from 'vitest/browser';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import '$src/app.css';
import FeatureSearchBox from './featureSearchBox.svelte';

test('a long feature-group list stays within the viewport and scrolls', async () => {
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
    .poll(() => element.getBoundingClientRect().bottom)
    .toBeLessThanOrEqual(window.innerHeight);
  expect(element.scrollHeight).toBeGreaterThan(element.clientHeight);
  expect(getComputedStyle(element).overflowY).toBe('auto');

  screen.unmount();
});
