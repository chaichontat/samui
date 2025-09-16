import { beforeEach, describe, expect, it, vi } from 'vitest';

const vectorSourceInstances: FakeVectorSource[] = [];

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
vi.mock('ol/layer/WebGLPoints.js', () => ({ default: class {} }));
vi.mock('ol', () => ({ View: class {}, Feature: FakeFeature }));

const mapStub = () => ({
  map: {
    addLayer: vi.fn(),
    removeLayer: vi.fn()
  },
  promise: Promise.resolve()
});

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
});

describe('ActiveSpots', () => {
  it('mounts layer and updates circle geometry', async () => {
    const { ActiveSpots } = await import('$src/lib/ui/overlays/points');
    const map = mapStub();
    const active = new ActiveSpots(map as any);
    active.mount();
    expect(map.map.addLayer).toHaveBeenCalledWith(active.layer);

    active.update(coords as any, 0);
    const circle = active.feature.getGeometry() as FakeCircle;
    expect(circle.lastSet).toEqual({ center: [10, -20], radius: coords.size! / 2 });
    expect(active.feature.get('id')).toBe('a');
  });
});

describe('CanvasSpots', () => {
  it('updates source with generated features when visible', async () => {
    const { CanvasSpots } = await import('$src/lib/ui/overlays/points');
    const map = mapStub();
    const canvas = new CanvasSpots(map as any);
    canvas.mount();

    canvas.update(coords as any);
    const source = vectorSourceInstances.at(-1)!;
    expect(source.addFeatures).toHaveBeenCalled();
    expect(source.features).toHaveLength(coords.pos.length);
  });

  it('skips feature population when above limit', async () => {
    const { CanvasSpots } = await import('$src/lib/ui/overlays/points');
    const map = mapStub();
    const canvas = new CanvasSpots(map as any);
    canvas.mount();

    const many = {
      ...coords,
      pos: Array.from({ length: 10050 }, (_, idx) => ({ x: idx, y: idx, idx }))
    };
    canvas.update(many as any);
    const source = vectorSourceInstances.at(-1)!;
    expect(source.features).toHaveLength(0);
  });

  it('defers updates while hidden and refreshes once visible again', async () => {
    const { CanvasSpots } = await import('$src/lib/ui/overlays/points');
    const map = mapStub();
    const canvas = new CanvasSpots(map as any);
    canvas.mount();

    const updateSpy = vi.spyOn(canvas as any, 'update_');
    canvas.visible = false;
    canvas.update(coords as any);
    expect(updateSpy).not.toHaveBeenCalled();

    canvas.visible = true;
    expect(updateSpy).toHaveBeenCalledTimes(1);
    updateSpy.mockRestore();
  });

  it('resets cached coordinate name when sample changes', async () => {
    const { CanvasSpots } = await import('$src/lib/ui/overlays/points');
    const map = mapStub();
    const canvas = new CanvasSpots(map as any);
    canvas.mount();

    canvas.update(coords as any);
    expect(canvas.currCoordName).toBe('coords');

    const other = { ...coords, name: 'other' };
    const updateSpy = vi.spyOn(canvas as any, 'update_');
    canvas.updateSample(other as any);
    expect(canvas.currCoordName).toBe('other');
    expect(updateSpy).toHaveBeenCalled();
    updateSpy.mockRestore();
  });
});
