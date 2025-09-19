import { describe, expect, it } from 'vitest';
import { page } from '@vitest/browser/context';
import { render } from 'vitest-browser-svelte';

import GlassIsland from './GlassIsland.svelte';

describe('GlassIsland', () => {
  const readWidth = (locator: ReturnType<typeof page.getByTestId>) => () => {
    const element = locator.query();
    if (!(element instanceof HTMLElement)) throw new Error('main not mounted');
    return element.style.width;
  };

  const readExpanded = (locator: ReturnType<typeof page.getByTestId>) => () => {
    const element = locator.query();
    if (!element) throw new Error('shell not mounted');
    return element.getAttribute('data-expanded');
  };

  it('respects disableExpansion by keeping dimensions fixed', async () => {
    const baseProps = {
      disableExpansion: true,
      baseWidth: 240,
      baseHeight: 60,
      expandWidthRatio: 3,
      expandHeightRatio: 2
    } as const;

    const screen = await render(GlassIsland, { props: { ...baseProps, expanded: false } });

    const shell = page.getByTestId('liquid-glass-island');
    const main = page.getByTestId('liquid-glass-island-main');

    await expect.poll(readWidth(main)).toBe('240px');
    await expect.poll(readExpanded(shell)).toBe('false');

    await screen.rerender({ ...baseProps, expanded: true });
    await expect.poll(readExpanded(shell)).toBe('true');
    await expect.poll(readWidth(main)).toBe('240px');

    await screen.rerender({ ...baseProps, expanded: false });
    await expect.poll(readExpanded(shell)).toBe('false');
    await expect.poll(readWidth(main)).toBe('240px');

    screen.unmount();
  });

  it('locks in expanded state when expandWidthRatio is 1', async () => {
    const baseProps = {
      baseWidth: 240,
      baseHeight: 60,
      expandWidthRatio: 1
    } as const;

    const screen = await render(GlassIsland, { props: { ...baseProps, expanded: false } });

    const shell = page.getByTestId('liquid-glass-island');
    const main = page.getByTestId('liquid-glass-island-main');

    await expect.poll(readExpanded(shell)).toBe('true');
    await expect.poll(readWidth(main)).toBe('auto');

    await screen.rerender({ ...baseProps, expanded: false });
    await expect.poll(readExpanded(shell)).toBe('true');
    await expect.poll(readWidth(main)).toBe('auto');

    await screen.rerender({ ...baseProps, expanded: true });
    await expect.poll(readExpanded(shell)).toBe('true');
    await expect.poll(readWidth(main)).toBe('auto');

    screen.unmount();
  });
});
