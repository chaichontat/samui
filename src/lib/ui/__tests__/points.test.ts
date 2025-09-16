import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockMap } from '$src/test/ol-helpers';

const createStoreMock = <T>(initial: T) => {
  let value = initial;
  const subscribers = new Set<(v: T) => void>();
  const store = {
    set: vi.fn((next: T) => {
      value = next;
      subscribers.forEach((cb) => cb(next));
    }),
    subscribe: (cb: (v: T) => void) => {
      cb(value);
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },
    update: vi.fn((fn: (curr: T) => T) => {
      store.set(fn(value));
    }),
    _get: () => value,
    _reset: (val: T = initial) => {
      value = val;
      store.set.mockClear();
      store.update.mockClear();
      subscribers.clear();
    }
  };
  return store;
};

class FakeFeature {
  props: Record<string, unknown>;
  id?: number | string;

  constructor(init: Record<string, unknown> = {}) {
    this.props = { ...init };
    this.props.geometry = init.geometry;
  }

  set(key: string, value: unknown) {
    this.props[key] = value;
  }

  get(key: string) {
    return this.props[key];
  }

  setId(id: number | string) {
    this.id = id;
  }

  getId() {
    return this.id;
  }

  getGeometry() {
    return this.props.geometry as { setCenterAndRadius?: (c: [number, number], r: number) => void };
  }
}

class FakePoint {
  constructor(public coords: [number, number]) {}
}

class FakeCircle {
  center: [number, number];
  radius: number;

  constructor(center: [number, number], radius: number) {
    this.center = center;
    this.radius = radius;
  }

  setCenterAndRadius(center: [number, number], radius: number) {
    this.center = center;
    this.radius = radius;
  }
}

class FakeVectorSource {
  features: FakeFeature[] = [];

  addFeatures = (features: FakeFeature[]) => {
    this.features.push(...features);
  };

  getFeatures = () => this.features;

  clear = () => {
    this.features = [];
  };

  changed = vi.fn();

  getFeatureById = (id: number | string) => this.features.find((f) => f.getId() === id);

  dispose = vi.fn();
}

class FakeVectorLayer {
  visible = true;
  style: unknown;
  source: FakeVectorSource;

  constructor(opts: { source: FakeVectorSource; style: unknown; zIndex?: number }) {
    this.source = opts.source;
    this.style = opts.style;
  }

  setVisible(value: boolean) {
    this.visible = value;
  }

  getVisible() {
    return this.visible;
  }

  updateStyleVariables = vi.fn();

  dispose = vi.fn();
}

class FakeWebGLPointsLayer extends FakeVectorLayer {
  constructor(opts: { source: FakeVectorSource; style: unknown; zIndex?: number }) {
    super(opts);
  }
}

class FakeFill {
  constructor(public opts: unknown) {}
}

class FakeStroke {
  constructor(public opts: unknown) {}
}

class FakeStyle {
  constructor(public opts: unknown) {}
}

class FakeView {
  constructor(public opts: Record<string, unknown>) {}
}

const sOverlayStore = createStoreMock<string | undefined>(undefined);
const sEventStore = { set: vi.fn(), subscribe: vi.fn(() => () => {}) };
const sFeatureDataStore = { set: vi.fn(), subscribe: vi.fn(() => () => {}) };

const genSpotStyle = vi.fn(() => ({ symbol: {}, variables: {} }));

vi.mock('ol/Feature.js', () => ({ default: FakeFeature }));
vi.mock('ol/geom.js', () => ({ Point: FakePoint, Circle: FakeCircle, Geometry: class {} }));
vi.mock('ol/source/Vector.js', () => ({ default: FakeVectorSource }));
vi.mock('ol/layer/Vector.js', () => ({ default: FakeVectorLayer }));
vi.mock('ol/layer/WebGLPoints.js', () => ({ default: FakeWebGLPointsLayer }));
vi.mock('ol/style.js', () => ({ Fill: FakeFill, Stroke: FakeStroke, Style: FakeStyle }));
vi.mock('ol', () => ({ View: FakeView, Feature: FakeFeature }));
vi.mock('$src/lib/sidebar/annotation/annoUtils', () => ({ FeatureLabel: FakeFeature }));
vi.mock('$src/lib/utils', () => ({ handleError: vi.fn(), rand: vi.fn(() => 'uid-123') }));
vi.mock('$src/lib/store', () => ({
  sOverlay: sOverlayStore,
  sEvent: sEventStore,
  sFeatureData: sFeatureDataStore
}));
vi.mock('../overlays/featureColormap', () => ({
  colorMaps: { turbo: () => '#fff', viridis: () => '#000' },
  genSpotStyle
}));

describe('WebGLSpots', () => {
  beforeEach(() => {
    sOverlayStore._reset(undefined);
    sEventStore.set.mockClear();
    sFeatureDataStore.set.mockClear();
    genSpotStyle.mockClear();
    vi.resetModules();
  });

  const loadModule = async () => {
    const mod = await import('../overlays/points');
    return mod;
  };

  it('setCurrStyle rebuilds the WebGL layer and updates style variables', async () => {
    const { WebGLSpots } = await loadModule();
    const mapImpl = createMockMap();
    const mapStub = {
      map: mapImpl,
      promise: Promise.resolve(),
      mPerPx: 2e-6,
      _needNewView: false
    } as any;

    const overlay = new WebGLSpots(mapStub);
    overlay.coords = { size: 4e-6, mPerPx: 2e-6, sizePx: 2 } as any;

    await overlay.setCurrStyle('quantitative', 'turbo');

    expect(genSpotStyle).toHaveBeenCalledWith({
      type: 'quantitative',
      spotSizeMeter: 4e-6,
      mPerPx: 2e-6,
      colorMap: 'turbo',
      scale: true
    });
    expect(mapImpl.addLayer).toHaveBeenCalledWith(expect.any(FakeWebGLPointsLayer));
    expect(overlay.layer?.updateStyleVariables).toHaveBeenCalledWith(overlay.currStyleVariables);
    expect(overlay.currStyle).toBe('quantitative');
  });

  it('update hydrates new feature data, rebuilds points, and triggers feature events', async () => {
    const { WebGLSpots } = await loadModule();
    const mapImpl = createMockMap();
    const mapStub = {
      map: mapImpl,
      promise: Promise.resolve(),
      mPerPx: 1,
      _needNewView: true
    } as any;

    const overlay = new WebGLSpots(mapStub);
    const coords = {
      name: 'coords',
      pos: [
        { x: 0, y: 0, idx: 0, id: 'a' },
        { x: 10, y: -4, idx: 1, id: 'b' }
      ],
      size: 2,
      mPerPx: 1,
      sizePx: 4
    };

    const sample = {
      name: 'sample-1',
      getFeature: vi.fn(async () => ({
        data: [1, 2],
        dataType: 'quantitative' as const,
        coords,
        minmax: [0, 10] as const,
        unit: 'ct'
      }))
    };

    sOverlayStore.set('uid-123');
    const result = await overlay.update(sample as any, { group: 'grp', feature: 'feat' });

    expect(sample.getFeature).toHaveBeenCalledTimes(1);
    expect(mapImpl.setView).toHaveBeenCalledWith(expect.any(FakeView));
    expect(mapStub._needNewView).toBe(false);
    expect(overlay.source.getFeatures()).toHaveLength(2);
    expect(sEventStore.set).toHaveBeenCalledWith({ type: 'featureUpdated' });
    expect(result?.unit).toBe('ct');
    expect(overlay.currFeature).toEqual({ group: 'grp', feature: 'feat' });
    expect(overlay.currSample).toBe('sample-1');
  });
});
