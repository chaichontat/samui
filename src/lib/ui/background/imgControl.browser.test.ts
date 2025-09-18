import { sEvent } from '$lib/store';
import { ImgData, type ImageParams } from '$src/lib/data/objects/image';
import { Background } from '$src/lib/ui/background/imgBackground';
import type { CompCtrl, ImgCtrl, RGBCtrl } from '$src/lib/ui/background/imgColormap';
import ImgControl from '$src/lib/ui/background/imgControl.svelte';
import { userEvent } from '@vitest/browser/context';
import { beforeEach, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

class BackgroundSpy extends Background {
  calls: ImgCtrl[] = [];
  lastStyleVars?: Record<string, number>;

  constructor(image: ImgData) {
    super();
    this.image = image;
    const originalUpdateStyle = this.updateStyle.bind(this);
    this.updateStyle = (ctrl: ImgCtrl) => {
      localStorage.setItem('imgCtrl', JSON.stringify(ctrl));
      this.calls.push(JSON.parse(JSON.stringify(ctrl)) as ImgCtrl);
      originalUpdateStyle(ctrl);
    };
  }

  override _updateStyle = (variables: Record<string, number>) => {
    this.lastStyleVars = { ...variables };
  };
}

type ImgControlScreen = ReturnType<typeof render<typeof ImgControl>>;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function latestComposite(background: BackgroundSpy): CompCtrl {
  const call = background.calls.at(-1);
  if (!call || call.type !== 'composite') {
    throw new Error('Expected latest background call to be composite');
  }
  return call as CompCtrl;
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
  sEvent.set(undefined);
});

async function setupCompositeControl(overrides?: Partial<ImageParams>) {
  const image = new ImgData({
    urls: [{ url: '/tiles', type: 'network' }],
    channels: ['dapi', 'actin', 'tubulin'],
    mPerPx: 1,
    defaultChannels: {
      red: 'actin',
      green: 'tubulin',
      blue: 'dapi'
    },
    maxVal: 4095,
    ...(overrides ?? {})
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
    const call = background.calls.at(-1);
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
  const { background, screen } = await setupCompositeControl({ channels, defaultChannels: {} });

  const state = latestComposite(background);
  expect(Object.keys(state.variables)).toEqual(channels);
  expect(state.variables.ch4.color).toBe('magenta');
  expect(state.variables.ch5.color).toBe('cyan');
  expect(state.variables.ch6.color).toBe('yellow');
  expect(state.variables.ch7.color).toBe('white');
  expect(state.variables.ch8.color).toBe('blue');

  screen.unmount();
});
