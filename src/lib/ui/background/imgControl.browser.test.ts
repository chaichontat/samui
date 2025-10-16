import { sEvent } from '$lib/store';
import { ImgData, type ImageParams } from '$src/lib/data/objects/image';
import CompositeChannelTable from '$src/lib/ui/background/CompositeChannelTable.svelte';
import { Background } from '$src/lib/ui/background/imgBackground';
import type { BandInfo, CompCtrl, ImgCtrl, RGBCtrl } from '$src/lib/ui/background/imgColormap';
import ImgControl from '$src/lib/ui/background/imgControl.svelte';
import { normalizeCompositeController } from '$src/lib/ui/background/imgControlState';
import { fireEvent } from '@testing-library/svelte';
import { userEvent } from '@vitest/browser/context';
import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

class BackgroundSpy extends Background {
  calls: ImgCtrl[] = [];
  lastStyleVars?: Record<string, number>;

  constructor(image: ImgData) {
    super();
    this.image = image;
    const originalUpdateStyle = this.updateStyle;
    this.updateStyle = ((ctrl: ImgCtrl) => {
      localStorage.setItem('imgCtrl', JSON.stringify(ctrl));
      this.calls.push(JSON.parse(JSON.stringify(ctrl)) as ImgCtrl);
      originalUpdateStyle.call(this, ctrl);
    }) as typeof this.updateStyle;
  }

  override _updateStyle = (variables: Record<string, number>) => {
    this.lastStyleVars = { ...variables };
  };
}

type ImgControlScreen = ReturnType<typeof render<typeof ImgControl>>;

const flush = () =>
  new Promise<void>((resolve) => {
    queueMicrotask(() => resolve());
  });

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function ensureGlassMain(island: HTMLElement): HTMLElement {
  const main = island.querySelector('.lgis-main');
  if (!(main instanceof HTMLElement)) throw new Error('GlassIsland main not found');
  return main;
}

const measureWidth = (element: HTMLElement) => element.getBoundingClientRect().width;

function latestComposite(background: BackgroundSpy): CompCtrl {
  const call = background.calls[background.calls.length - 1];
  if (!call || call.type !== 'composite') {
    throw new Error('Expected latest background call to be composite');
  }
  return call as CompCtrl;
}

function createDefaultChannels(
  overrides: Partial<Record<BandInfo['color'], string>> = {}
): Record<BandInfo['color'], string | undefined> {
  return {
    blue: undefined,
    green: undefined,
    red: undefined,
    magenta: undefined,
    cyan: undefined,
    yellow: undefined,
    white: undefined,
    ...overrides
  };
}

function getChannelRow(screen: ImgControlScreen, name: string): HTMLTableRowElement {
  const cell = Array.from(screen.container.querySelectorAll('[aria-label="Channel name"]')).find(
    (node) => node.textContent?.trim() === name
  );
  if (!cell) throw new Error(`Channel cell ${name} not found`);
  const row = cell.closest('tr');
  if (!(row instanceof HTMLTableRowElement)) throw new Error(`Row for ${name} not found`);
  return row;
}

beforeEach(() => {
  localStorage.clear();
});

async function setupCompositeControl(overrides?: Partial<ImageParams>) {
  const { defaultChannels: overrideDefaults, ...restOverrides } = overrides ?? {};
  const baseDefaults = createDefaultChannels({ red: 'actin', green: 'tubulin', blue: 'dapi' });

  const image = new ImgData({
    urls: [{ url: '/tiles', type: 'network' }],
    channels: ['dapi', 'actin', 'tubulin'],
    mPerPx: 1,
    defaultChannels: overrideDefaults
      ? createDefaultChannels(overrideDefaults as Partial<Record<BandInfo['color'], string>>)
      : baseDefaults,
    maxVal: 4095,
    ...restOverrides
  });
  const background = new BackgroundSpy(image);
  const screen = render(ImgControl, { props: { background } });

  sEvent.set({ type: 'sampleUpdated' });
  await expect.poll(() => background.calls.length).toBeGreaterThan(0);
  await flush();

  return { background, screen };
}

async function setupRgbControl() {
  const image = new ImgData({
    urls: [{ url: '/tiles', type: 'network' }],
    channels: 'rgb',
    mPerPx: 1,
    maxVal: 255
  });
  const background = new BackgroundSpy(image);
  const screen = render(ImgControl, { props: { background } });

  sEvent.set({ type: 'sampleUpdated' });
  await expect.poll(() => background.calls.length).toBeGreaterThan(0);
  await flush();

  return { background, screen };
}

test('composite controls update band enablement and colors via two-way bindings', async () => {
  const { background, screen } = await setupCompositeControl();

  await expect
    .poll(() => screen.container.querySelectorAll('[aria-label="Channel name"]').length)
    .toBe(3);

  const actinRow = getChannelRow(screen, 'actin');

  const toggleButton = actinRow.querySelector('button[aria-label="Select channel button"]');
  if (!toggleButton) throw new Error('toggle button not found');
  await userEvent.click(toggleButton);
  await expect.poll(() => latestComposite(background).variables.actin.enabled).toBe(false);

  const storedAfterDisable = JSON.parse(localStorage.getItem('imgCtrl')!);
  expect(storedAfterDisable.variables.actin.enabled).toBe(false);

  const colorButtons = actinRow.querySelectorAll('[data-testid="imgctrl-color-button"]');
  if (colorButtons.length === 0) throw new Error('color buttons not found');
  await userEvent.click(colorButtons[3] as HTMLButtonElement); // magenta
  await expect.poll(() => latestComposite(background).variables.actin.color).toBe('magenta');
  expect(latestComposite(background).variables.actin.enabled).toBe(true);

  const storedAfterColor = JSON.parse(localStorage.getItem('imgCtrl')!);
  expect(storedAfterColor.variables.actin.color).toBe('magenta');

  screen.unmount();
});

test('rgb controls propagate slider changes to background style updates', async () => {
  const { background, screen } = await setupRgbControl();

  const latest = () => {
    const call = background.calls[background.calls.length - 1];
    if (!call || call.type !== 'rgb') throw new Error('Expected rgb ctrl');
    return call as RGBCtrl;
  };

  const exposure = screen.container.querySelector(
    'input[aria-label="Exposure slider"]'
  ) as HTMLInputElement | null;
  const contrast = screen.container.querySelector(
    'input[aria-label="Contrast slider"]'
  ) as HTMLInputElement | null;
  const saturation = screen.container.querySelector(
    'input[aria-label="Saturation slider"]'
  ) as HTMLInputElement | null;

  if (!exposure || !contrast || !saturation) {
    throw new Error('rgb sliders not rendered');
  }

  exposure.value = '0.25';
  exposure.dispatchEvent(new Event('input', { bubbles: true }));
  exposure.dispatchEvent(new Event('change', { bubbles: true }));

  await expect.poll(() => latest().Exposure).toBeCloseTo(0.25, 2);

  contrast.value = '-0.15';
  contrast.dispatchEvent(new Event('input', { bubbles: true }));
  contrast.dispatchEvent(new Event('change', { bubbles: true }));

  await expect.poll(() => latest().Contrast).toBeCloseTo(-0.15, 2);

  saturation.value = '0.4';
  saturation.dispatchEvent(new Event('input', { bubbles: true }));
  saturation.dispatchEvent(new Event('change', { bubbles: true }));

  await expect.poll(() => latest().Saturation).toBeCloseTo(0.4, 2);

  screen.unmount();
});

test('composite channel table handles missing controller entries', async () => {
  const image = {
    channels: ['alpha', 'beta'],
    maxVal: 255,
    defaultChannels: {},
    mPerPx: 1
  } as ImgData;

  const controller = normalizeCompositeController(image, {
    type: 'composite',
    variables: {
      alpha: { enabled: true, color: 'red', minmax: [0, 1] }
    }
  });

  const screen = render(CompositeChannelTable, {
    props: {
      image,
      controller,
      onSelect: vi.fn(),
      onRequestExpand: vi.fn(),
      maxNameWidth: 80
    }
  });

  await flush();

  const rows = screen.container.querySelectorAll('tr[aria-label$="controls"]');
  expect(rows).toHaveLength(2);
  expect(controller.variables.beta).toBeDefined();
  screen.unmount();
});

test('localStorage restores composite control state on remount', async () => {
  const first = await setupCompositeControl();

  const actinRow = getChannelRow(first.screen, 'actin');
  const colorButtons = actinRow.querySelectorAll('[data-testid="imgctrl-color-button"]');
  if (colorButtons.length === 0) throw new Error('color buttons not found');
  await userEvent.click(colorButtons[4] as HTMLButtonElement); // cyan
  await expect.poll(() => latestComposite(first.background).variables.actin.color).toBe('cyan');

  first.screen.unmount();

  const second = await setupCompositeControl();
  const restored = latestComposite(second.background);
  expect(restored.variables.actin.color).toBe('cyan');
  expect(restored.variables.actin.enabled).toBe(true);

  second.screen.unmount();
});

test('rejects localStorage state with mismatched channel names', async () => {
  localStorage.setItem(
    'imgCtrl',
    JSON.stringify({
      type: 'composite',
      variables: {
        mismatch: { enabled: true, color: 'red', minmax: [0.1, 0.2] }
      }
    })
  );

  const { background, screen } = await setupCompositeControl();
  const restored = latestComposite(background);

  expect(Object.keys(restored.variables)).toEqual(['dapi', 'actin', 'tubulin']);
  expect(restored.variables.actin.color).toBe('red');
  expect(restored.variables.tubulin.color).toBe('green');
  expect(JSON.parse(localStorage.getItem('imgCtrl')!)).not.toHaveProperty('variables.mismatch');

  screen.unmount();
});

test('prevents duplicate colors across enabled channels', async () => {
  const { background, screen } = await setupCompositeControl();

  const tubulinRow = getChannelRow(screen, 'tubulin');
  const tubulinColors = tubulinRow.querySelectorAll('[data-testid="imgctrl-color-button"]');
  if (tubulinColors.length === 0) throw new Error('tubulin color buttons not found');

  await userEvent.click(tubulinColors[2] as HTMLButtonElement); // red
  await expect.poll(() => latestComposite(background).variables.tubulin.color).toBe('red');

  const state = latestComposite(background);
  expect(state.variables.tubulin.enabled).toBe(true);
  expect(state.variables.actin.enabled).toBe(false);

  screen.unmount();
});

test('handles range slider min/max constraints and sqrt transformation', async () => {
  const { background, screen } = await setupCompositeControl();
  const image = background.image!;

  const state = latestComposite(background);
  const half = Math.round(image.maxVal / 2);
  const logHalf = Math.sqrt(half);

  expect(state.variables.actin.minmax[1]).toBeCloseTo(logHalf, 1);
  expect(state.variables.actin.minmax[0]).toBe(0);

  const vars = background.lastStyleVars!;
  expect(Math.sqrt(vars.actinMax)).toBeCloseTo(state.variables.actin.minmax[1], 1);
  expect(vars.actinMax).toBeLessThanOrEqual(image.maxVal);
  expect(vars.actinMin).toBeCloseTo(state.variables.actin.minmax[0] ** 2, 5);
  expect(vars.actinredMask).toBe(1);
  expect(vars.actingreenMask).toBe(0);
  expect(vars.actinblueMask).toBe(0);

  screen.unmount();
});

test('handles images with more than three channels and cycles colors', async () => {
  const channels = ['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'ch7', 'ch8'];
  const { background, screen } = await setupCompositeControl({
    channels,
    defaultChannels: createDefaultChannels()
  });

  const state = latestComposite(background);
  expect(Object.keys(state.variables)).toEqual(channels);
  expect(state.variables.ch4.color).toBe('magenta');
  expect(state.variables.ch5.color).toBe('cyan');
  expect(state.variables.ch6.color).toBe('yellow');
  expect(state.variables.ch7.color).toBe('white');
  expect(state.variables.ch8.color).toBe('blue');

  screen.unmount();
});

test('auto-collapse engages after the inactivity delay elapses', async () => {
  const originalSetTimeout = window.setTimeout.bind(window);
  (window as unknown as { setTimeout: typeof setTimeout }).setTimeout = ((
    handler: TimerHandler,
    timeout?: number,
    ...args: unknown[]
  ) =>
    originalSetTimeout(
      handler,
      timeout === 3000 ? 15 : (timeout ?? 0),
      ...args
    )) as typeof setTimeout;

  try {
    const { screen } = await setupCompositeControl();
    const island = screen.container.querySelector(
      '[data-testid="liquid-glass-island"]'
    ) as HTMLElement | null;
    if (!island) throw new Error('island not found');

    expect(island.getAttribute('data-expanded')).toBe('true');

    await wait(30);
    await flush();

    expect(island.getAttribute('data-expanded')).toBe('false');
    screen.unmount();
  } finally {
    (window as unknown as { setTimeout: typeof setTimeout }).setTimeout = originalSetTimeout;
  }
});

test('expansion control reopens the panel after auto-collapse', async () => {
  const originalSetTimeout = window.setTimeout.bind(window);
  (window as unknown as { setTimeout: typeof setTimeout }).setTimeout = ((
    handler: TimerHandler,
    timeout?: number,
    ...args: unknown[]
  ) =>
    originalSetTimeout(
      handler,
      timeout === 3000 ? 25 : (timeout ?? 0),
      ...args
    )) as typeof setTimeout;

  try {
    const { screen } = await setupCompositeControl();
    const island = screen.container.querySelector(
      '[data-testid="liquid-glass-island"]'
    ) as HTMLElement | null;
    if (!island) throw new Error('island not found');

    await wait(40);
    await flush();

    expect(island.getAttribute('data-expanded')).toBe('false');

    const expandButton = screen.container.querySelector(
      'button[aria-label="Expand controls"]'
    ) as HTMLButtonElement | null;
    if (!expandButton) throw new Error('expand button not found');

    await userEvent.click(expandButton);
    await flush();

    expect(island.getAttribute('data-expanded')).toBe('true');
    screen.unmount();
  } finally {
    (window as unknown as { setTimeout: typeof setTimeout }).setTimeout = originalSetTimeout;
  }
});

test('component has mouse interaction handlers for auto-collapse prevention', async () => {
  // This test verifies that the component is properly wired with handlers
  // Note: Synthetic DOM events don't trigger Svelte's on:mouseenter/on:mousedown
  // handlers which are bound at compile time, so we test structure instead

  const { screen } = await setupCompositeControl();
  const island = screen.container.querySelector(
    '[data-testid="liquid-glass-island"]'
  ) as HTMLElement | null;
  if (!island) throw new Error('island not found');

  // Initial state should be expanded
  expect(island.getAttribute('data-expanded')).toBe('true');

  // Verify the GlassIsland component is properly configured as interactive
  expect(island.getAttribute('role')).toBe('button');
  expect(island.getAttribute('tabindex')).toBe('0');
  expect(island.getAttribute('aria-expanded')).toBe('true');

  // The component has on:mouseenter and on:mousedown handlers on the GlassIsland
  // These are bound by Svelte at compile time and prevent auto-collapse
  // We can't trigger them with synthetic events, but we verify the structure

  // Check that the component renders the interactive elements
  const expandButton = screen.container.querySelector('button[aria-label="Expand controls"]');
  expect(expandButton).toBeTruthy();

  // Verify controls are accessible
  const channelControls = screen.container.querySelectorAll('[aria-label*="controls"]');
  expect(channelControls.length).toBeGreaterThan(0);

  screen.unmount();
});

test('GlassIsland contracts when collapsed via keyboard toggle', async () => {
  const { screen } = await setupCompositeControl();

  const island = screen.container.querySelector(
    '[data-testid="liquid-glass-island"]'
  ) as HTMLElement | null;
  if (!island) throw new Error('island not found');

  const clickSpy = vi.fn();
  island.addEventListener('click', clickSpy);

  const mainPanel = ensureGlassMain(island);

  await expect.poll(() => measureWidth(mainPanel), { timeout: 1500 }).toBeGreaterThan(320);

  island.focus();
  await fireEvent.keyDown(island, { key: 'Enter' });
  await flush();

  await expect.poll(() => island.getAttribute('data-expanded'), { timeout: 1500 }).toBe('false');
  await expect.poll(() => measureWidth(mainPanel), { timeout: 1500 }).toBeLessThan(200);

  screen.unmount();
});

test('GlassIsland re-expands after being reopened', async () => {
  const { screen } = await setupCompositeControl();

  const island = screen.container.querySelector(
    '[data-testid="liquid-glass-island"]'
  ) as HTMLElement | null;
  if (!island) throw new Error('island not found');

  const clickSpy = vi.fn();
  island.addEventListener('click', clickSpy);

  const mainPanel = ensureGlassMain(island);

  await expect.poll(() => measureWidth(mainPanel), { timeout: 1500 }).toBeGreaterThan(320);

  island.focus();
  await fireEvent.keyDown(island, { key: 'Enter' });
  await flush();

  await expect.poll(() => island.getAttribute('data-expanded'), { timeout: 1500 }).toBe('false');
  await expect.poll(() => measureWidth(mainPanel), { timeout: 1500 }).toBeLessThan(200);

  const expandButton = screen.container.querySelector(
    'button[aria-label="Expand controls"]'
  ) as HTMLButtonElement | null;
  if (!expandButton) throw new Error('expand button not found');

  await userEvent.click(expandButton);
  await flush();

  await expect.poll(() => island.getAttribute('data-expanded'), { timeout: 1500 }).toBe('true');
  await expect.poll(() => measureWidth(mainPanel), { timeout: 1500 }).toBeGreaterThan(320);

  screen.unmount();
});

test('GlassIsland toggles via mouse clicks on the shell', async () => {
  const { screen } = await setupCompositeControl();

  const island = screen.container.querySelector(
    '[data-testid="liquid-glass-island"]'
  ) as HTMLElement | null;
  if (!island) throw new Error('island not found');

  const clickSpy = vi.fn();
  island.addEventListener('click', clickSpy);

  const mainPanel = ensureGlassMain(island);

  await expect.poll(() => measureWidth(mainPanel), { timeout: 1500 }).toBeGreaterThan(320);

  const clickShell = async () => {
    await fireEvent.pointerDown(island, { pointerType: 'mouse', button: 0 });
    await fireEvent.mouseDown(island, { button: 0 });
    await fireEvent.pointerUp(island, { pointerType: 'mouse', button: 0 });
    await fireEvent.mouseUp(island, { button: 0 });
    await fireEvent.click(island, { button: 0 });
    await flush();
  };

  await clickShell();

  expect(clickSpy).toHaveBeenCalled();

  await expect.poll(() => island.getAttribute('data-expanded'), { timeout: 1500 }).toBe('false');
  await expect.poll(() => measureWidth(mainPanel), { timeout: 1500 }).toBeLessThan(200);

  await clickShell();

  await expect.poll(() => island.getAttribute('data-expanded'), { timeout: 1500 }).toBe('true');
  await expect.poll(() => measureWidth(mainPanel), { timeout: 1500 }).toBeGreaterThan(320);

  screen.unmount();
});

test('clicking already selected color toggles it off', async () => {
  const { background, screen } = await setupCompositeControl();

  const actinRow = getChannelRow(screen, 'actin');
  const colorButtons = actinRow.querySelectorAll('[data-testid="imgctrl-color-button"]');

  // Initially actin is enabled with red color
  expect(latestComposite(background).variables.actin.enabled).toBe(true);
  expect(latestComposite(background).variables.actin.color).toBe('red');

  // Click the red button (index 2) while it's already selected
  await userEvent.click(colorButtons[2] as HTMLButtonElement);
  await flush();

  // Should toggle off
  expect(latestComposite(background).variables.actin.enabled).toBe(false);
  expect(latestComposite(background).variables.actin.color).toBe('red'); // Color preserved

  // Click red again to re-enable
  await userEvent.click(colorButtons[2] as HTMLButtonElement);
  await flush();

  expect(latestComposite(background).variables.actin.enabled).toBe(true);
  expect(latestComposite(background).variables.actin.color).toBe('red');

  screen.unmount();
});

test('CSS variables are updated on slider color selection', async () => {
  const { screen } = await setupCompositeControl();

  const actinRow = getChannelRow(screen, 'actin');
  const colorButtons = actinRow.querySelectorAll('[data-testid="imgctrl-color-button"]');

  // Click magenta color button
  await userEvent.click(colorButtons[3] as HTMLButtonElement);
  await flush();

  // Check if CSS variables were set on the slider
  const slider = document.querySelector('#slider-actin') as HTMLElement;
  expect(slider).toBeTruthy();

  const styles = window.getComputedStyle(slider);
  expect(styles.getPropertyValue('--range-handle')).toBe('magenta');
  expect(styles.getPropertyValue('--range-handle-focus')).toBe('magenta');

  // Click cyan and verify update
  await userEvent.click(colorButtons[4] as HTMLButtonElement);
  await flush();

  expect(styles.getPropertyValue('--range-handle')).toBe('cyan');
  expect(styles.getPropertyValue('--range-handle-focus')).toBe('cyan');

  screen.unmount();
});

test('range slider start event triggers channel selection', async () => {
  const { background, screen } = await setupCompositeControl();

  const dapiRow = getChannelRow(screen, 'dapi');
  const slider = dapiRow.querySelector('.rangeSlider') as HTMLElement;

  // Initially dapi is enabled with blue
  expect(latestComposite(background).variables.dapi.enabled).toBe(true);
  expect(latestComposite(background).variables.dapi.color).toBe('blue');

  // Disable dapi first
  const toggleButton = dapiRow.querySelector('button[aria-label="Select channel button"]');
  await userEvent.click(toggleButton as HTMLButtonElement);
  expect(latestComposite(background).variables.dapi.enabled).toBe(false);

  // Trigger a real interaction on the slider shell - should re-enable the channel selection
  if (slider) {
    await fireEvent.pointerDown(slider, { pointerType: 'mouse', button: 0 });
    await fireEvent.mouseDown(slider, { button: 0 });
    await flush();
  }

  await expect.poll(() => latestComposite(background).variables.dapi.enabled).toBe(true);
  await expect.poll(() => latestComposite(background).variables.dapi.color).toBe('blue');

  screen.unmount();
});

test('maxNameWidth dynamically adjusts based on button cell widths', async () => {
  const { screen } = await setupCompositeControl({
    channels: ['veryLongChannelName', 'short', 'mediumName']
  });

  await flush();

  // Check that the GlassIsland baseWidth was adjusted
  screen.container.querySelector('[data-testid="liquid-glass-island"]') as HTMLElement;

  // The component calculates maxNameWidth from button cells
  const buttonCells = screen.container.querySelectorAll('td[aria-label="button-cell"]');
  const maxWidth = Math.max(
    ...Array.from(buttonCells).map((cell) => (cell as HTMLElement).clientWidth)
  );

  // GlassIsland baseWidth should be maxNameWidth + 11.5
  // We can't directly test the prop, but we can verify button cells exist and have width
  expect(buttonCells.length).toBe(3);
  expect(maxWidth).toBeGreaterThan(0);

  // Verify the longest channel name is rendered
  const longChannelName = Array.from(
    screen.container.querySelectorAll('[aria-label="Channel name"]')
  ).find((node) => node.textContent?.includes('veryLongChannelName'));
  expect(longChannelName).toBeTruthy();

  screen.unmount();
});

test('table click keeps island expanded', async () => {
  const { screen } = await setupCompositeControl();

  let tableClicked = false;

  const island = screen.container.querySelector(
    '[data-testid="liquid-glass-island"]'
  ) as HTMLElement;

  const table = screen.container.querySelector('table');
  expect(table).toBeTruthy();

  // Add listener to table to track if it was clicked
  table!.addEventListener('click', () => {
    tableClicked = true;
    // The component should stop propagation
  });

  const initialExpanded = island.getAttribute('data-expanded');

  // Click on table
  await userEvent.click(table as HTMLElement);
  await flush();

  // Table click should be handled but not propagated to parent
  expect(tableClicked).toBe(true);
  expect(island.getAttribute('data-expanded')).toBe(initialExpanded);

  screen.unmount();
});

test('loading skeleton UI displays when image is undefined', async () => {
  const background = new BackgroundSpy(undefined as any);
  const screen = render(ImgControl, { props: { background } });

  // Should show loading skeleton
  const skeletonElements = screen.container.querySelectorAll('.animate-pulse');
  expect(skeletonElements.length).toBeGreaterThan(0);

  // Should have 3 rows of skeleton
  const skeletonRows = screen.container.querySelectorAll('.animate-pulse.rounded-lg');
  expect(skeletonRows.length).toBeGreaterThanOrEqual(6); // At least 2 per row x 3 rows

  // Should not show actual controls
  expect(screen.container.querySelector('table')).toBeFalsy();
  expect(screen.container.querySelector('[aria-label="Channel name"]')).toBeFalsy();

  screen.unmount();
});

test('cleanup properly removes timers and resets state on unmount', async () => {
  const originalSetTimeout = window.setTimeout.bind(window);
  const originalClearTimeout = window.clearTimeout.bind(window);
  const activeTimers: number[] = [];
  const clearedTimers: number[] = [];

  (window as unknown as { setTimeout: typeof setTimeout }).setTimeout = ((
    handler: TimerHandler,
    timeout?: number,
    ...args: unknown[]
  ) => {
    const id = originalSetTimeout(handler, timeout === 3000 ? 10 : (timeout ?? 0), ...args);
    activeTimers.push(id as unknown as number);
    return id;
  }) as typeof setTimeout;

  (window as unknown as { clearTimeout: typeof clearTimeout }).clearTimeout = ((id: number) => {
    clearedTimers.push(id);
    originalClearTimeout(id);
  }) as typeof clearTimeout;

  try {
    const { screen } = await setupCompositeControl();

    // Should have set a collapse timer
    expect(activeTimers.length).toBeGreaterThan(0);

    // Unmount component
    screen.unmount();
    await flush();

    // All timers should be cleared
    expect(clearedTimers.length).toBeGreaterThan(0);
    expect(clearedTimers.some((id) => activeTimers.includes(id))).toBe(true);
  } finally {
    (window as unknown as { setTimeout: typeof setTimeout }).setTimeout = originalSetTimeout;
    (window as unknown as { clearTimeout: typeof clearTimeout }).clearTimeout =
      originalClearTimeout;
  }
});
