import { describe, expect, it } from 'vitest';

import { buildSearch, meterToPixel, parseViewState, pixelToMeter } from '$src/lib/ui/urlState';

describe('parseViewState', () => {
  it('parses a full state', () => {
    expect(parseViewState('?x=100&y=-50&z=3.5&g=genes&f=GFAP&sample=Br2720')).toEqual({
      center: [100, -50],
      zoom: 3.5,
      feature: { group: 'genes', feature: 'GFAP' },
      sample: 'Br2720'
    });
  });

  it('requires both x and y for a center', () => {
    expect(parseViewState('?x=100').center).toBeUndefined();
    expect(parseViewState('?y=100').center).toBeUndefined();
  });

  it('requires both group and feature', () => {
    expect(parseViewState('?g=genes').feature).toBeUndefined();
    expect(parseViewState('?f=GFAP').feature).toBeUndefined();
  });

  it('ignores non-numeric and empty coordinates', () => {
    expect(parseViewState('?x=foo&y=bar&z=baz')).toEqual({});
    // Empty values must not coerce to 0.
    expect(parseViewState('?x=&y=&z=')).toEqual({});
  });

  it('keeps zero coordinates and zoom', () => {
    expect(parseViewState('?x=0&y=0&z=0')).toEqual({ center: [0, 0], zoom: 0 });
  });

  it('returns an empty state for an empty query', () => {
    expect(parseViewState('')).toEqual({});
  });
});

describe('buildSearch', () => {
  it('preserves the existing sample-loading params', () => {
    const out = buildSearch('?url=data.example.com/&s=Br2720', {
      center: [10, 20],
      zoom: 2,
      feature: { group: 'genes', feature: 'GFAP' }
    });
    const p = new URLSearchParams(out);
    expect(p.get('url')).toBe('data.example.com/');
    expect(p.get('s')).toBe('Br2720');
    expect(p.get('x')).toBe('10');
    expect(p.get('y')).toBe('20');
    expect(p.get('z')).toBe('2');
    expect(p.get('g')).toBe('genes');
    expect(p.get('f')).toBe('GFAP');
  });

  it('rounds center to integers and zoom to two decimals', () => {
    const p = new URLSearchParams(buildSearch('', { center: [10.7, -20.2], zoom: 3.14159 }));
    expect(p.get('x')).toBe('11');
    expect(p.get('y')).toBe('-20');
    expect(p.get('z')).toBe('3.14');
  });

  it('writes zero coordinates rather than dropping them', () => {
    const p = new URLSearchParams(buildSearch('', { center: [0, 0], zoom: 0 }));
    expect(p.get('x')).toBe('0');
    expect(p.get('y')).toBe('0');
    expect(p.get('z')).toBe('0');
  });

  it('removes only the viewer params, preserving url/s', () => {
    const out = buildSearch('?url=data.example.com/&s=A&s=B&x=1&y=2&z=3&g=a&f=b&sample=c', {});
    const p = new URLSearchParams(out);
    expect(p.getAll('s')).toEqual(['A', 'B']);
    expect(p.get('url')).toBe('data.example.com/');
    expect(p.get('x')).toBeNull();
    expect(p.get('g')).toBeNull();
  });

  it('rounds zoom lossily to two decimals (intentional)', () => {
    expect(parseViewState(buildSearch('', { zoom: 3.14159 }))).toEqual({ zoom: 3.14 });
  });

  it('round-trips through parseViewState', () => {
    const state = {
      center: [10, -20] as [number, number],
      zoom: 2.5,
      feature: { group: 'genes', feature: 'GFAP' },
      sample: 'Br2720'
    };
    expect(parseViewState(buildSearch('', state))).toEqual(state);
  });
});

describe('pixel/meter conversion', () => {
  it('negates the y axis and is invertible', () => {
    expect(meterToPixel([100, 200], 2)).toEqual([50, -100]);
    expect(pixelToMeter([50, -100], 2)).toEqual([100, 200]);
    expect(pixelToMeter(meterToPixel([123, -456], 0.5), 0.5)).toEqual([123, -456]);
  });
});
