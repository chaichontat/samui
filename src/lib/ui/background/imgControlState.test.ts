import { describe, expect, it, vi } from 'vitest';
import { ImgData } from '$src/lib/data/objects/image';
import {
  buildCompositeController,
  buildRgbController,
  cloneController,
  restoreCompositeController,
  selectChannelColor
} from './imgControlState';

describe('imgControlState helpers', () => {
  const createCompositeImage = (defaults?: Record<string, string | undefined>) =>
    new ImgData({
      urls: [{ url: '/tiles', type: 'network' }],
      channels: ['dapi', 'actin', 'tubulin'],
      mPerPx: 1,
      maxVal: 4095,
      defaultChannels: defaults as any
    });

  it('builds an RGB controller with zeroed sliders', () => {
    const ctrl = buildRgbController();
    expect(ctrl).toEqual({ type: 'rgb', Exposure: 0, Contrast: 0, Saturation: 0 });
  });

  it('builds composite controller with defaults and palette fallbacks', () => {
    const ctrl = buildCompositeController(createCompositeImage());

    expect(ctrl.type).toBe('composite');
    expect(Object.keys(ctrl.variables)).toEqual(['dapi', 'actin', 'tubulin']);
    expect(ctrl.variables.dapi.enabled).toBe(true);
    expect(ctrl.variables.dapi.color).toBe('red');
  });

  it('restores composite controller from localStorage when channels match', () => {
    const ctrl = buildCompositeController(createCompositeImage());
    localStorage.setItem('imgCtrl', JSON.stringify(ctrl));

    const restored = restoreCompositeController(['dapi', 'actin', 'tubulin']);
    expect(restored?.variables.dapi.color).toBe(ctrl.variables.dapi.color);
  });

  it('ignores stored controller when channels mismatch', () => {
    localStorage.setItem(
      'imgCtrl',
      JSON.stringify({ type: 'composite', variables: { other: { enabled: true, color: 'red', minmax: [0, 1] } } })
    );

    expect(restoreCompositeController(['alpha'])).toBeNull();
  });

  it('selectChannelColor toggles off duplicates and reassigns target channel', () => {
    const ctrl = buildCompositeController(createCompositeImage());

    selectChannelColor(ctrl, 'actin', 'blue', true);
    expect(ctrl.variables.actin.color).toBe('blue');
    expect(ctrl.variables.actin.enabled).toBe(true);

    selectChannelColor(ctrl, 'actin', 'blue', true);
    expect(ctrl.variables.actin.enabled).toBe(false);
  });

  it('cloneController returns a deep copy', () => {
    const original = buildRgbController();
    const cloned = cloneController(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
  });

  it('handles invalid localStorage JSON gracefully', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('imgCtrl', '{');

    expect(restoreCompositeController(['a'])).toBeNull();
    spy.mockRestore();
  });
});

