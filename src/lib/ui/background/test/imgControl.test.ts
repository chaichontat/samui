import { ImgData } from '$src/lib/data/objects/image';
import { sEvent } from '$src/lib/store';
import '@testing-library/jest-dom';
import {
  findByLabelText,
  fireEvent,
  getByLabelText,
  getByText,
  render,
  screen
} from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event/dist/types/setup/setup';
import { cloneDeep, zip } from 'lodash-es';
import { describe, expect, it, vi, type MockedFunction } from 'vitest';
import { Background } from '../imgBackground';
import { colors, type CompCtrl } from '../imgColormap';
import ImgControl from '../imgControl.svelte';

// https://stackoverflow.com/a/37580979
function permute<T>(permutation: T[]) {
  const length = permutation.length;
  const result = [permutation.slice()];
  const c = new Array(length).fill(0) as number[];
  let i = 1;
  let k: number;
  let p: T;

  while (i < length) {
    if (c[i] < i) {
      k = i % 2 && c[i];
      p = permutation[i];
      permutation[i] = permutation[k];
      permutation[k] = p;
      ++c[i];
      i = 1;
      result.push(permutation.slice());
    } else {
      c[i] = 0;
      ++i;
    }
  }
  return result;
}

describe('RGB control', () => {
  beforeEach(() => {
    const background = new Background();
    background.image = new ImgData({ channels: 'rgb', mPerPx: 1, urls: [] });
    render(ImgControl, { background });
    sEvent.set({ type: 'sampleUpdated' });
  });

  it('should render rgb', async () => {
    expect(await screen.findByText('Exposure:')).toBeInTheDocument();
  });
});

describe('Composite control', () => {
  // Didn't use beforeEach because of concurrent.
  // But svelte-testing-library doesn't support concurrent.
  let user: UserEvent;
  let channels: string[];
  let background: Background;
  let getCalls: () => Parameters<typeof background.updateStyle>[];

  beforeEach(() => {
    user = userEvent.setup();
    channels = ['ax', 'bx', 'cx', 'dx'];
    background = new Background();
    background.image = new ImgData({ channels, mPerPx: 1, urls: [] });
    // @ts-expect-error
    background.updateStyle = vi.fn().mockName('updateStyle');
    render(ImgControl, { background });
    sEvent.set({ type: 'sampleUpdated' });
    getCalls = () =>
      (background.updateStyle as MockedFunction<typeof background.updateStyle>).mock.calls;
  });

  afterEach(() => {
    // vi.restoreAllMocks();
  });

  const checkDupe = ({ variables }: CompCtrl) => {
    const counts = {} as Record<string, number>;
    colors.forEach((c) => (counts[c] = 0));
    for (const v of Object.values(variables)) {
      if (v.enabled) counts[v.color] += 1;
    }
    for (const c of Object.values(counts)) {
      expect(c).toBeLessThanOrEqual(1);
    }
  };

  it('should render composite', async () => {
    // wait for store to update.
    expect(await screen.findAllByRole('row')).toHaveLength(4);
    for (const channel of channels) {
      expect(await screen.findByText(channel)).toBeInTheDocument();
    }
  });

  it('should expand on hover', async () => {
    vi.useFakeTimers();
    const el = await screen.findByLabelText('Image controls');
    el.dispatchEvent(new Event('mouseenter'));
    expect(getComputedStyle(el).maxWidth).toBe('100%');
    el.dispatchEvent(new Event('mouseleave'));
    const promise = new Promise((r) => setTimeout(r, 1510));
    vi.runAllTimers();
    await promise;
    expect(getComputedStyle(el).maxWidth.endsWith('px')).toBeTruthy();
    el.dispatchEvent(new Event('mouseenter'));
    expect(getComputedStyle(el).maxWidth).toBe('100%');
    vi.useRealTimers();
  });

  it('should toggle channels on/off correctly', async () => {
    const els_ = channels.map((c) => screen.findByLabelText(`${c} controls`));
    const els = await Promise.all(els_);
    const chanButtons = zip(channels, els).map(([channel, el]) => getByText(el!, channel!));

    // On-off-on
    let prevState: CompCtrl;
    {
      const first = chanButtons[0];
      await user.click(first);
      expect(getCalls().pop()![0].variables[first.textContent!].enabled).toBe(false);
      await user.click(first);
      prevState = cloneDeep(getCalls().pop()![0] as CompCtrl);
      expect(prevState.variables[first.textContent!].enabled).toBe(true);
    }

    for (let i = 0; i < 100; i++) {
      const sampled = Math.floor(Math.random() * els.length);
      const channel = els[sampled];

      const toPick = colors[Math.floor(Math.random() * colors.length)];
      const color = getByLabelText(channel, `${toPick} color button`);

      await user.click(color);
      const res = getCalls().pop()![0] as CompCtrl;
      checkDupe(res);

      const v = res.variables[channels[sampled]];
      expect(v.color).toBe(toPick);
      expect(v.enabled).toBe(
        !(
          prevState.variables[channels[sampled]].enabled &&
          prevState.variables[channels[sampled]].color === toPick
        )
      );
      prevState = cloneDeep(res);
    }
  });

  it('should not bind multiple channels to the same color', async () => {
    const colorButtons = screen.getAllByTestId('imgctrl-color-button');
    for (let i = 0; i < 100; i++) {
      await user.click(colorButtons[Math.floor(Math.random() * colorButtons.length)]);
      checkDupe(getCalls().pop()![0] as CompCtrl);
    }
  });

  it('should adjust slider', async () => {
    const els_ = channels.map((c) => screen.findByLabelText(`${c} controls`));
    const els = await Promise.all(els_);
    for (const [i, channel] of els.entries()) {
      const range = await findByLabelText(channel, 'Max channel intensity slider');
      await fireEvent.change(range, { target: { value: 170 } });
      expect(getCalls().pop()![0].variables[channels[i]].max).toBe(170);
      await fireEvent.change(range, { target: { value: 1 } });
      expect(getCalls().pop()![0].variables[channels[i]].max).toBe(1);
    }
  });
});
