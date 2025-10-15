import { beforeEach, describe, expect, it, vi } from 'vitest';

const vectorSourceInstances: FakeVectorSource[] = [];
const webglVectorLayerInstances: FakeWebGLVectorLayer[] = [];

class FakeVectorSource {
  features: any[] = [];
  constructor() {
    vectorSourceInstances.push(this);
  }
  addFeatures = vi.fn((features: any[]) => {
    this.features.push(...features);
  });
  clear = vi.fn(() => {
    this.features = [];
  });
  getFeatureById = (id: number) => this.features.find((f) => f.id === id);
  dispose = vi.fn();
}

class FakeVectorLayer {
  visible = true;
  constructor(public options: any) {}
  setVisible(value: boolean) {
    this.visible = value;
  }
  getVisible() {
    return this.visible;
  }
  getSource() {
    return this.options.source;
  }
  dispose = vi.fn();
}

class FakeCircle {
  constructor(
    public center: [number, number],
    public radius: number
  ) {}
  lastSet?: { center: [number, number]; radius: number };
  setCenterAndRadius(center: [number, number], radius: number) {
    this.lastSet = { center, radius };
  }
}

class FakePoint {
  constructor(public coords: [number, number]) {}
}

class FakeFeature {
  props: Record<string, any>;
  private id: number | string | undefined;
  constructor(props: Record<string, any>) {
    this.props = props;
  }
  setId(id: number | string) {
    this.id = id;
  }
  getId() {
    return this.id;
  }
  set(key: string, value: any) {
    this.props[key] = value;
  }
  get(key: string) {
    return this.props[key];
  }
  getGeometry() {
    return this.props.geometry;
  }
}

class FakeFeatureLabel extends FakeFeature {
  label?: string;
}

class FakeWebGLVectorLayer {
  options: any;
  source: any;
  updateStyleVariables = vi.fn((vars: Record<string, any>) => {
    this.options.variables = { ...this.options.variables, ...vars };
  });
  setStyle = vi.fn((style: any) => {
    this.options.style = style;
  });
  changed = vi.fn();
  dispose = vi.fn();

  constructor(options: any) {
    this.options = { ...options };
    this.source = options.source;
    webglVectorLayerInstances.push(this);
  }
}

vi.mock('ol/source/Vector.js', () => ({ default: FakeVectorSource }));
vi.mock('ol/layer/Vector.js', () => ({ default: FakeVectorLayer }));
vi.mock('ol/geom.js', () => ({ Circle: FakeCircle, Point: FakePoint }));
vi.mock('ol/Feature.js', () => ({ default: FakeFeature }));
vi.mock('$src/lib/sidebar/annotation/annoUtils', () => ({ FeatureLabel: FakeFeatureLabel }));
vi.mock('ol/style.js', () => ({
  Fill: class {},
  Stroke: class {},
  Style: class {}
}));
vi.mock('ol/layer/WebGLVector.js', () => ({ default: FakeWebGLVectorLayer }));
vi.mock('ol', () => ({ View: class {}, Feature: FakeFeature }));

const mapStub = () => {
  const layers: any[] = [];
  const addLayer = vi.fn((layer: any) => {
    layers.push(layer);
  });
  const removeLayer = vi.fn((layer: any) => {
    const idx = layers.indexOf(layer);
    if (idx >= 0) layers.splice(idx, 1);
  });
  const getLayers = () => ({
    getArray: () => layers,
    insertAt: (idx: number, layer: any) => {
      layers.splice(idx, 0, layer);
    }
  });

  return {
    map: {
      addLayer,
      removeLayer,
      getLayers
    },
    mPerPx: 2e-6,
    promise: Promise.resolve()
  };
};

const coords = {
  name: 'coords',
  pos: [
    { x: 1, y: 2, id: 'a', idx: 0 },
    { x: 3, y: -4, id: 'b', idx: 1 }
  ],
  size: 2,
  mPerPx: 10
};

beforeEach(() => {
  vectorSourceInstances.length = 0;
  webglVectorLayerInstances.length = 0;
});

describe('WebGLSpots', () => {
  it('constructs a WebGLVectorLayer with style and variables', async () => {
    const { WebGLSpots } = await import('$src/lib/ui/overlays/points');
    const map = mapStub();
    const overlay = new WebGLSpots(map as any);
    overlay.coords = {
      size: 2,
      sizePx: 4,
      mPerPx: 10
    } as any;

    await overlay.setCurrStyle('quantitative', 'turbo');

    expect(webglVectorLayerInstances).toHaveLength(1);
    const layer = webglVectorLayerInstances[0];
    expect(layer.options.style).toMatchObject({ 'circle-radius': expect.anything() });
    expect(layer.options.variables).toMatchObject({ opacity: 1, min: 0, max: 0 });
    expect(layer.updateStyleVariables).toHaveBeenCalledWith(overlay.currStyleVariables);
  });

  it('preserves live style variables when switching styles', async () => {
    const { WebGLSpots } = await import('$src/lib/ui/overlays/points');
    const map = mapStub();
    const overlay = new WebGLSpots(map as any);
    overlay.coords = {
      size: 2,
      sizePx: 4,
      mPerPx: 10
    } as any;

    await overlay.setCurrStyle('quantitative', 'turbo');
    overlay.updateStyleVariables({ opacity: 0.4 });

    await overlay.setCurrStyle('categorical', overlay.currColorMap);

    const layer = webglVectorLayerInstances.at(-1)!;
    expect(overlay.currStyleVariables.opacity).toBeCloseTo(0.4);
    expect(layer.options.variables?.opacity).toBeCloseTo(0.4);
    expect(layer.updateStyleVariables).toHaveBeenCalledWith(overlay.currStyleVariables);
  });
});

describe('genSpotStyle', () => {
  it('returns separated style and variables for quantitative overlays', async () => {
    const { genSpotStyle } = await import('$src/lib/ui/overlays/featureColormap');
    const result = genSpotStyle({
      type: 'quantitative',
      spotSizeMeter: 2e-6,
      mPerPx: 2e-6,
      colorMap: 'turbo',
      scale: true
    });

    expect(result.style).toHaveProperty('circle-radius');
    expect(result.variables).toMatchObject({ opacity: 1, min: 0, max: 0 });
  });

  it('respects small spot sizes when scaling overlays', async () => {
    const { genSpotStyle } = await import('$src/lib/ui/overlays/featureColormap');
    const result = genSpotStyle({
      type: 'quantitative',
      spotSizeMeter: 5e-7,
      mPerPx: 2e-6,
      colorMap: 'turbo',
      scale: true
    });

    const radiusExpression = result.style['circle-radius'] as unknown[];
    expect(radiusExpression[0]).toBe('clamp');
    const minRadius = radiusExpression[2];
    expect(typeof minRadius).toBe('number');
    expect(minRadius as number).toBeLessThan(1);
    expect(minRadius as number).toBeGreaterThan(0);
  });
});
