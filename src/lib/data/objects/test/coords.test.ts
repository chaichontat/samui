import { describe, expect, it } from 'vitest';

import { CoordsData } from '../coords';

const sampleCoords = Array.from({ length: 10 }, (_, idx) => ({ x: idx, y: -idx }));

describe('CoordsData', () => {
  it('requires either coordinates or url source', () => {
    expect(
      () =>
        new CoordsData({
          name: 'bad',
          shape: 'circle',
          mPerPx: 1,
          size: 2
        })
    ).toThrow('Must provide url or value');
  });

  it('computes size in pixels from provided metadata', () => {
    const coords = new CoordsData({
      name: 'pixels',
      shape: 'circle',
      mPerPx: 0.5,
      size: 2,
      pos: [{ x: 0, y: 0 }]
    });
    expect(coords.sizePx).toBe(4);
  });

  it('assigns indices and subsamples when sample limit provided', () => {
    const coords = new CoordsData({
      name: 'subsampled',
      shape: 'circle',
      mPerPx: 1,
      size: 1,
      pos: sampleCoords,
      sample: 3
    });

    expect(coords.pos).toHaveLength(3);
    const indices = coords.pos!.map((c) => c.idx);
    expect(indices).toEqual([0, 4, 8]);
  });
});
