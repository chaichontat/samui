import { HoverSelect } from '$lib/sidebar/searchBox';
import { hoverSelect, sSample } from '$lib/store';
import Recent from '$src/lib/sidebar/recent.svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

const makeFeature = (name: string) => ({ group: 'grp', feature: name });

afterEach(() => {
  hoverSelect.set(new HoverSelect());
  sSample.set(undefined as any);
});

describe('Recent sidebar', () => {
  test('clears queue when sample changes', async () => {
    const { getByText, container, unmount } = render(Recent);

    sSample.set({ name: 'sample-a' } as any);
    hoverSelect.set(new HoverSelect({ selected: makeFeature('geneA') }));
    await tick();

    expect(getByText('geneA')).toBeTruthy();

    sSample.set({ name: 'sample-b' } as any);
    await tick();

    expect(container.textContent).not.toContain('geneA');
    expect(container.textContent).toContain('No recent features (yet).');

    unmount();
  });
});
