import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockMap, createMockOverlay } from '$src/test/ol-helpers';
import type { Writable } from 'svelte/store';

type StoreMocks = {
  overlays?: Writable<Record<string, any>>;
  sOverlay?: Writable<string | undefined>;
  sEvent?: {
    set: ReturnType<typeof vi.fn>;
    subscribe: (run: (value: unknown) => void) => () => void;
  };
  sEventSpy?: ReturnType<typeof vi.fn>;
  initialOverlay?: ReturnType<typeof createMockOverlay>;
};

const setupModuleMocks = (mapImpl: ReturnType<typeof createMockMap>) => {
  const storeMocks: StoreMocks = {};
  vi.doMock('ol', () => ({
    Map: vi.fn(() => mapImpl),
    Overlay: vi.fn(() => ({})),
    View: vi.fn()
  }));
  vi.doMock('ol/control/Zoom.js', () => ({ default: vi.fn() }));
  vi.doMock('ol/control/ScaleLine.js', () => ({ default: vi.fn() }));

  vi.doMock('../background/imgBackground', () => ({
    Background: vi.fn().mockImplementation(() => ({
      mount: vi.fn(),
      update: vi.fn(() => Promise.resolve()),
      dispose: vi.fn(),
      image: undefined,
      source: { getView: vi.fn(() => Promise.resolve({ resolutions: [1, 2], at: vi.fn(() => 2) })) },
      mPerPx: 1
    }))
  }));

  vi.doMock('../overlays/points', () => {
    const mockOverlay = createMockOverlay();
    storeMocks.initialOverlay = mockOverlay;
    return {
      ActiveSpots: vi.fn().mockImplementation(() => ({
        mount: vi.fn(),
        visible: true,
        layer: undefined
      })),
      WebGLSpots: vi.fn().mockImplementation(() => mockOverlay),
      BaseSpots: class {
        mount = vi.fn();
      }
    };
  });

  vi.doMock('../sidebar/annotation/annFeat', () => ({
    DrawFeature: vi.fn().mockImplementation(() => ({
      mount: vi.fn()
    }))
  }));

  vi.doMock('../sidebar/annotation/mutableSpots', () => ({
    MutableSpots: vi.fn().mockImplementation(() => ({ mount: vi.fn() }))
  }));

  vi.doMock('../sidebar/annotation/annROI', () => ({
    Draww: vi.fn().mockImplementation(() => ({ mount: vi.fn() }))
  }));

  vi.doMock('../store', async () => {
    const { writable } = await import('svelte/store');
    const mapTiles = writable([0]);
    const overlays = writable({});
    const sOverlay = writable(undefined);
    const sEventWritable = writable(undefined);
    const sEvent = {
      set: vi.fn(),
      subscribe: sEventWritable.subscribe.bind(sEventWritable)
    };

    Object.assign(storeMocks, { overlays, sOverlay, sEvent });

    return {
      mapTiles,
      overlays,
      sOverlay,
      sEvent,
      annoFeat: writable({ reverseKeys: {}, keys: [] }),
      annoROI: writable({ keys: [] }),
      sPixel: writable(undefined),
      overlaysFeature: writable({}),
      sSample: writable(undefined),
      setHoverSelect: vi.fn(() => Promise.resolve())
    };
  });
  return storeMocks;
};

describe('Mapp', () => {
  let MappClass: typeof import('../mapp').Mapp;
  let map: ReturnType<typeof createMockMap>;
  let storeMocks: StoreMocks;

  beforeEach(async () => {
    vi.resetModules();
    map = createMockMap();
    storeMocks = setupModuleMocks(map);
    ({ Mapp: MappClass } = await import('../mapp'));
    const storeModule = await import('$src/lib/store');
    storeMocks.overlays = storeModule.overlays;
    storeMocks.sOverlay = storeModule.sOverlay;
    storeMocks.sEvent = storeModule.sEvent;
    const originalSet = storeModule.sEvent.set.bind(storeModule.sEvent);
    const eventSpy = vi.fn((value) => originalSet(value));
    storeModule.sEvent.set = eventSpy as typeof storeModule.sEvent.set;
    storeMocks.sEventSpy = eventSpy;
  });

  it('mount sets up map, controls, and overlay bootstrap', () => {
    const target = document.createElement('div');
    const tippy = document.createElement('div');

    const instance = new MappClass();
    instance.mount(target, tippy);

    expect(instance.map).toBeDefined();
    expect(map.addControl).toHaveBeenCalledTimes(2);
    expect(instance.tippy?.elem).toBe(tippy);
    expect(map.on).toHaveBeenCalledWith('pointermove', expect.any(Function));
    expect(map.on).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('updateSample hydrates sample, updates background, and refreshes overlays', async () => {
    const target = document.createElement('div');
    const tippy = document.createElement('div');

    const instance = new MappClass();
    instance.mount(target, tippy);

    const overlayLayer = {};
    let overlaySpy: ReturnType<typeof vi.fn> | undefined;
    if (storeMocks.initialOverlay) {
      storeMocks.initialOverlay.layer = overlayLayer as any;
      overlaySpy = storeMocks.initialOverlay.updateSample;
      storeMocks.sOverlay?.set(storeMocks.initialOverlay.uid);
    } else {
      const fallback = {
        uid: 'overlay-1',
        layer: overlayLayer,
        currFeature: undefined,
        updateSample: vi.fn(() => Promise.resolve(true))
      };
      overlaySpy = fallback.updateSample;
      storeMocks.overlays?.set({ [fallback.uid]: fallback });
      storeMocks.sOverlay?.set(fallback.uid);
    }
    const overlaySpyAssert = overlaySpy ?? vi.fn();

    const hydrate = vi.fn(() => Promise.resolve());
    const background = instance.persistentLayers.background as unknown as {
      update: ReturnType<typeof vi.fn>;
      dispose: ReturnType<typeof vi.fn>;
      source: { getView: () => Promise<{ resolutions: number[] }> };
    };

    const sample: any = {
      name: 'demo',
      hydrate,
      image: {
        promise: Promise.resolve(),
        urls: [{ url: { url: 'http://example.com/1' } }],
        channels: ['r', 'g', 'b'],
        mode: 'rgb',
        maxVal: 2048,
        mPerPx: 2e-6
      },
      features: {},
      overlayParams: undefined,
      featureParams: undefined
    };

    await instance.updateSample(sample);

    expect(hydrate).toHaveBeenCalledTimes(1);
    expect(background.update).toHaveBeenCalledWith(instance.map, sample.image);
    expect(instance.persistentLayers.active.visible).toBe(false);
    expect(overlaySpyAssert).toHaveBeenCalledWith(sample);
    const eventSpy = storeMocks.sEventSpy;
    expect(eventSpy).toBeDefined();
    expect(eventSpy!).toHaveBeenCalledWith({ type: 'sampleUpdated' });
  });

  it('runPointerListener notifies matching listeners and clears misses on pointermove', async () => {
    const target = document.createElement('div');
    const tippy = document.createElement('div');

    const instance = new MappClass();
    instance.mount(target, tippy);

    const overlayLayer = {};
    storeMocks.overlays?.set({ foo: { layer: overlayLayer } as any });
    storeMocks.sOverlay?.set('foo');

    const hitListener = vi.fn();
    const missListener = vi.fn();
    instance.attachPointerListener({ pointermove: hitListener }, { layer: overlayLayer as any });
    instance.attachPointerListener({ pointermove: missListener }, { layer: {} as any });

    const mapImpl = map;
    const feature = {
      getId: vi.fn(() => 7),
      get: vi.fn((key: string) => (key === 'id' ? 'spot-7' : undefined))
    };
    mapImpl.forEachFeatureAtPixel.mockImplementation((_pixel, cb) => {
      cb(feature as any, overlayLayer as any);
      return undefined;
    });

    const event = {
      type: 'pointermove',
      pixel: [0, 0],
      coordinate: [1, 1],
      originalEvent: { pressure: 0 }
    } as unknown as Parameters<typeof instance.runPointerListener>[0];

    instance.runPointerListener(event);

    expect(hitListener).toHaveBeenCalledWith({ idx: 7, id: 'spot-7', feature }, event);
    expect(missListener).toHaveBeenCalledWith(null, event);
  });

  it('moveView animates when zoom threshold met', () => {
    const target = document.createElement('div');
    const tippy = document.createElement('div');

    const instance = new MappClass();
    instance.mount(target, tippy);
    instance.persistentLayers.background.mPerPx = 2;

    instance.moveView({ x: 4, y: 5 }, 6);

    expect(map.getView().animate).toHaveBeenCalledWith({
      center: [8, 10],
      duration: 100,
      zoom: 6
    });
  });
});
