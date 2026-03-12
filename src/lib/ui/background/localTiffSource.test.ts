import { describe, expect, it } from 'vitest';

import { buildLocalTiffViewOptions } from './localTiffSource';

describe('buildLocalTiffViewOptions', () => {
  it('builds a pixel-space view centered on the TIFF extent without GeoTIFF source metadata', () => {
    const view = buildLocalTiffViewOptions({
      channels: ['C1', 'C2'],
      maxVal: 65535,
      mPerPx: 2,
      renderMode: 'local-tiff',
      size: { width: 300, height: 120 },
      urls: []
    });

    expect(view.center).toEqual([300, -120]);
    expect(view.extent).toEqual([0, -240, 600, 0]);
    expect(view.showFullExtent).toBe(true);
    expect(view.resolutions).toEqual([256, 4, 2, 1, 0.5]);
  });
});
