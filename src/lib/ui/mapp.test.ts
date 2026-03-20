import { describe, expect, it } from 'vitest';

import { buildMapResolutions } from './mapp';

describe('buildMapResolutions', () => {
  it('keeps multi-resolution GeoTIFF views in descending order', () => {
    expect(buildMapResolutions([64, 16])).toEqual([2048, 64, 32, 16, 8, 4]);
  });

  it('builds a valid descending view for single-resolution GeoTIFFs', () => {
    expect(buildMapResolutions([0.5])).toEqual([64, 1, 0.5, 0.25, 0.125]);
  });
});
