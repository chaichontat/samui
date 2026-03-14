import { describe, expect, it } from 'vitest';

import { ImgData } from '$src/lib/data/objects/image';
import { shouldEstimateCompositeDefaults } from './imgBackground';

describe('shouldEstimateCompositeDefaults', () => {
  it('stays off for the standard composite COG path', () => {
    const image = new ImgData({
      urls: [
        { url: 'https://example.com/C1.tif', type: 'network' },
        { url: 'https://example.com/C2.tif', type: 'network' }
      ],
      channels: ['C1', 'C2'],
      mPerPx: 1,
      maxVal: 255
    });

    expect(shouldEstimateCompositeDefaults(image)).toBe(false);
  });

  it('stays on for imported local TIFF composites without explicit defaults', () => {
    const image = new ImgData({
      urls: [{ url: 'blob:scan', type: 'network' }],
      channels: ['C1', 'C2'],
      renderMode: 'local-tiff',
      size: { width: 10, height: 10 },
      mPerPx: 1,
      maxVal: 255
    });

    expect(shouldEstimateCompositeDefaults(image)).toBe(true);
  });

  it('stays off when defaults are already present', () => {
    const image = new ImgData({
      urls: [{ url: 'blob:scan', type: 'network' }],
      channels: ['C1', 'C2'],
      renderMode: 'local-tiff',
      size: { width: 10, height: 10 },
      defaultMinMax: { C1: [1, 10], C2: [2, 20] },
      mPerPx: 1,
      maxVal: 255
    });

    expect(shouldEstimateCompositeDefaults(image)).toBe(false);
  });
});
