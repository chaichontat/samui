import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

import { Sample } from '$src/lib/data/objects/sample';
import { HoverSelect } from '$src/lib/sidebar/searchBox';
import {
  hoverSelect,
  mapIdSample,
  sEvent,
  sMapId,
  sMapp,
  sOverlay,
  sSample,
  samples,
  setHoverSelect
} from '$src/lib/store';
import type { Mapp } from '$src/lib/ui/mapp';
import {
  buildSearch,
  meterToPixel,
  parseChannels,
  parseViewState,
  pixelToMeter,
  setChannelParam,
  UrlStateController
} from '$src/lib/ui/urlState';

let resetFeatureId = 0;

beforeEach(() => {
  vi.useRealTimers();
  sOverlay.set('active-overlay');
  void setHoverSelect({
    selected: { group: '__test_reset__', feature: String(resetFeatureId++) }
  });
  hoverSelect.set(new HoverSelect());
  mapIdSample.set({});
  samples.set([]);
  sEvent.set(undefined);
  sMapId.set(0);
  sMapp.set(undefined);
  sSample.set(undefined);
});

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

describe('channel params', () => {
  it('parses channel:color pairs', () => {
    expect(parseChannels('?c=DAPI:blue,GFP:green')).toEqual([
      { channel: 'DAPI', color: 'blue' },
      { channel: 'GFP', color: 'green' }
    ]);
  });

  it('returns an empty array when absent', () => {
    expect(parseChannels('?x=1')).toEqual([]);
    expect(parseChannels('')).toEqual([]);
  });

  it('drops segments with an unknown color or no channel name', () => {
    expect(parseChannels('?c=DAPI:teal,GFP:green,:red,bad')).toEqual([
      { channel: 'GFP', color: 'green' }
    ]);
  });

  it('keeps colons in channel names (splits on the last one)', () => {
    expect(parseChannels('?c=ratio:a:b:red')).toEqual([{ channel: 'ratio:a:b', color: 'red' }]);
  });

  it('sets the c param while preserving other params', () => {
    const out = setChannelParam('?url=data.example.com/&x=1', [{ channel: 'DAPI', color: 'blue' }]);
    const p = new URLSearchParams(out);
    expect(p.get('url')).toBe('data.example.com/');
    expect(p.get('x')).toBe('1');
    expect(parseChannels(out)).toEqual([{ channel: 'DAPI', color: 'blue' }]);
  });

  it('removes the c param for an empty selection', () => {
    expect(new URLSearchParams(setChannelParam('?c=DAPI:blue&x=1', [])).get('c')).toBeNull();
  });

  it('leaves c untouched through buildSearch (separate writers)', () => {
    const out = buildSearch('?c=DAPI:blue', { zoom: 2 });
    expect(new URLSearchParams(out).get('c')).toBe('DAPI:blue');
  });
});

describe('pixel/meter conversion', () => {
  it('negates the y axis and is invertible', () => {
    expect(meterToPixel([100, 200], 2)).toEqual([50, -100]);
    expect(pixelToMeter([50, -100], 2)).toEqual([100, 200]);
    expect(pixelToMeter(meterToPixel([123, -456], 0.5), 0.5)).toEqual([123, -456]);
  });
});

describe('UrlStateController restore sequencing', () => {
  it('waits for the requested sample before restoring the feature', () => {
    const sampleA = new Sample({ name: 'A' });
    const sampleB = new Sample({ name: 'B' });
    const targetFeature = { group: 'genes', feature: 'GFAP' };

    samples.set([
      { name: 'A', sample: sampleA },
      { name: 'B', sample: sampleB }
    ]);
    mapIdSample.set({ 0: 'A' });
    sSample.set(sampleA);

    const controller = new UrlStateController('?sample=B&g=genes&f=GFAP');
    controller.start();

    try {
      sEvent.set({ type: 'sampleUpdated' });

      expect(get(mapIdSample)[0]).toBe('B');
      expect(get(hoverSelect).active).toBeUndefined();

      sSample.set(sampleB);
      sEvent.set({ type: 'sampleUpdated' });

      expect(get(hoverSelect).active).toEqual(targetFeature);
    } finally {
      controller.stop();
    }
  });

  it('does not write the current map state while the requested sample is still pending', () => {
    vi.useFakeTimers();

    const sampleA = new Sample({ name: 'A' });
    const sampleB = new Sample({ name: 'B' });
    const view = {
      getCenter: () => [10, -20] as [number, number],
      getZoom: () => 4,
      setCenter: vi.fn(),
      setZoom: vi.fn()
    };
    const fakeMapp = {
      mPerPx: 1,
      map: {
        getView: () => view,
        on: () => undefined
      }
    } as unknown as Mapp;

    samples.set([
      { name: 'A', sample: sampleA },
      { name: 'B', sample: sampleB }
    ]);
    mapIdSample.set({ 0: 'A' });
    sSample.set(sampleA);
    sMapp.set(fakeMapp);
    window.history.replaceState(null, '', '/?url=data.example.com&s=A&s=B&sample=B&g=genes&f=GFAP');

    const controller = new UrlStateController(window.location.search);
    controller.start();

    try {
      sEvent.set({ type: 'renderComplete' });
      sEvent.set({ type: 'featureUpdated' });
      vi.advanceTimersByTime(350);

      const params = new URLSearchParams(window.location.search);
      expect(params.get('x')).toBeNull();
      expect(params.get('sample')).toBe('B');
      expect(params.get('g')).toBe('genes');
      expect(params.get('f')).toBe('GFAP');
    } finally {
      controller.stop();
      vi.useRealTimers();
    }
  });
});
