import { CoordsData } from '$src/lib/data/objects/coords';
import { cloneDeep } from 'lodash-es';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { schemeTableau10 } from 'd3';

class TestFeature {
  props: Record<string, any>;
  private identifier: number | string | undefined;

  constructor(props: Record<string, any> = {}) {
    this.props = { ...props };
  }

  setId(id: number | string) {
    this.identifier = id;
  }

  getId() {
    return this.identifier;
  }

  set(key: string, value: unknown) {
    this.props[key] = value;
  }

  get<T>(key: string): T {
    return this.props[key];
  }

  getGeometry() {
    return this.props.geometry;
  }
}

class TestFeatureLabel<T extends TestPoint | TestCircle> extends TestFeature {
  private style: unknown;

  getLabel(returnAll = false): string | string[] | undefined {
    const stored = this.get<string | undefined>('label');
    const labels = stored ? stored.split(',').filter(Boolean) : [];
    if (returnAll) return labels.length ? labels : undefined;
    return labels.at(-1);
  }

  addLabel(label: string) {
    const labels = (this.get<string | undefined>('label') ?? '').split(',').filter(Boolean);
    const idx = labels.indexOf(label);
    if (idx > -1) labels.splice(idx, 1);
    labels.push(label);
    this.set('label', labels.join(','));
    return label;
  }

  removeLabel(label: string) {
    const labels = (this.get<string | undefined>('label') ?? '').split(',').filter(Boolean);
    const idx = labels.indexOf(label);
    if (idx > -1) labels.splice(idx, 1);
    this.set('label', labels.length ? labels.join(',') : undefined);
    return labels.at(-1);
  }

  setStyle(style: unknown) {
    this.style = style;
  }

  getStyle() {
    return this.style;
  }
}

class TestPoint {
  constructor(private coords: [number, number]) {}

  getCoordinates() {
    return this.coords;
  }
}

class TestCircle {
  constructor(
    public center: [number, number],
    public radius: number
  ) {}

  getCenter() {
    return this.center;
  }

  getExtent() {
    const [x, y] = this.center;
    return [x - this.radius, y - this.radius, x + this.radius, y + this.radius];
  }

  intersectsCoordinate([x, y]: [number, number]) {
    const [cx, cy] = this.center;
    return Math.hypot(x - cx, y - cy) <= this.radius + 1e-9;
  }
}

class TestVectorSource {
  features: TestFeatureLabel<TestPoint | TestCircle>[] = [];

  addFeatures(features: TestFeatureLabel<TestPoint | TestCircle>[]) {
    this.features.push(...features);
  }

  getFeatureById(id: number | string) {
    return this.features.find((f) => f.getId() === id);
  }

  getFeatures() {
    return [...this.features];
  }

  getFeaturesInExtent([minX, minY, maxX, maxY]: number[]) {
    return this.features.filter((f) => {
      const geom = f.getGeometry() as TestPoint | TestCircle;
      if (geom instanceof TestCircle) {
        const [x, y] = geom.getCenter();
        return x >= minX && x <= maxX && y >= minY && y <= maxY;
      }
      const [x, y] = geom.getCoordinates();
      return x >= minX && x <= maxX && y >= minY && y <= maxY;
    });
  }

  forEachFeature(cb: (f: TestFeatureLabel<TestPoint | TestCircle>) => void) {
    this.features.forEach(cb);
  }

  clear() {
    this.features = [];
  }

  dispose() {}
}

class TestVectorLayer {
  visible = true;
  constructor(public options: any) {}
  setVisible(value: boolean) {
    this.visible = value;
  }
  getVisible() {
    return this.visible;
  }
  dispose() {}
}

class TestInteractionCollection {
  clear() {}
}

class TestSelect {
  private handler: ((event: any) => void) | undefined;
  private collection = new TestInteractionCollection();
  constructor(public options: any) {}
  on(_event: string, handler: (event: any) => void) {
    this.handler = handler;
    return this;
  }
  getFeatures() {
    return this.collection;
  }
}

const clickSymbol = Symbol('click');

vi.mock('ol/Feature.js', () => ({ default: TestFeature }));
vi.mock('$src/lib/sidebar/annotation/annoUtils', () => ({ FeatureLabel: TestFeatureLabel }));
vi.mock('ol/geom.js', () => ({ Circle: TestCircle, Point: TestPoint, Polygon: TestCircle }));
vi.mock('ol/source/Vector', () => ({ default: TestVectorSource }));
vi.mock('ol/source/Vector.js', () => ({ default: TestVectorSource }));
vi.mock('ol/layer/Vector.js', () => ({ default: TestVectorLayer }));
vi.mock('ol/style.js', () => ({
  Fill: class {},
  RegularShape: class {},
  Stroke: class {},
  Style: class {}
}));
vi.mock('ol/interaction', () => ({ Select: TestSelect }));
vi.mock('ol/events/condition', () => ({ click: clickSymbol }));
vi.mock('ol', () => ({ Feature: TestFeature }));

type MutableSpotsCtor = typeof import('../mutableSpots').MutableSpots;
let MutableSpotsClass: MutableSpotsCtor;
let mutable: InstanceType<MutableSpotsCtor>;
let ready: Promise<void>;
let overlaySource: TestVectorSource;

const labels = ['a', 'b', 'c'];
const coordsData = new CoordsData({
  name: 'test',
  shape: 'circle',
  mPerPx: 0.1,
  pos: Array.from({ length: 10 }, (_, i) => ({ x: i, y: 0, id: i }))
});
const keyMap = { a: 0, b: 1, c: 2 };

const createOverlaySource = () => {
  const src = new TestVectorSource();
  coordsData.pos!.forEach((p, idx) => {
    const feature = new TestFeatureLabel({
      geometry: new TestPoint([p.x * coordsData.mPerPx, -p.y * coordsData.mPerPx])
    });
    feature.setId(idx);
    src.addFeatures([feature]);
  });
  return src;
};

const createMap = () => ({
  map: {
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    addInteraction: vi.fn()
  }
});

beforeAll(async () => {
  ready = (async () => {
    ({ MutableSpots: MutableSpotsClass } = await import('../mutableSpots'));
    mutable = new MutableSpotsClass(createMap() as any);
    mutable.mount();
  })();
  await ready;
});

const runInit = async () => {
  await ready;
  overlaySource = createOverlaySource();
  mutable.startDraw(cloneDeep(coordsData), keyMap, overlaySource as any);
};

describe('it should fail before startDraw', () => {
  it('should not run before startDraw', async () => {
    await ready;
    const unstarted = new MutableSpotsClass(createMap() as any);
    unstarted.mount();
    expect(unstarted.coordsSource).toBeUndefined();
    expect(() => unstarted.add(0, labels[0])).toThrow();
    expect(() =>
      unstarted.addFromPolygon(new TestFeature({ geometry: new TestCircle([0, 0], 1) }) as any)
    ).toThrow();
  });
});

describe('test updateFeature', () => {
  let feature: TestFeatureLabel<TestPoint>;

  beforeAll(async () => {
    await runInit();
    feature = new TestFeatureLabel({ geometry: new TestPoint([0, 0]) });
  });

  it('should add a label', () => {
    mutable.updatePoint(feature as any, labels[0]);
    expect(feature.get('label')).toBe(labels[0]);
    expect(feature.get('color')).toBe(schemeTableau10[0].concat('cc'));
  });

  it('should add a label to an existing one', () => {
    mutable.updatePoint(feature as any, labels[1]);
    expect(feature.get('label')).toBe(labels.slice(0, 2).join(','));
    expect(feature.get('color')).toBe(schemeTableau10[1].concat('cc'));
  });

  it('should not stack the same label on top of one another', () => {
    mutable.updatePoint(feature as any, labels[1]);
    expect(feature.get('label')).toBe(labels.slice(0, 2).join(','));
    expect(feature.get('color')).toBe(schemeTableau10[1].concat('cc'));
  });

  it('should make the latest label the rightmost one', () => {
    mutable.updatePoint(feature as any, labels[0]);
    expect(feature.get('label')).toBe([labels[1], labels[0]].join(','));
    expect(feature.get('color')).toBe(schemeTableau10[0].concat('cc'));
  });

  it('should remove the rightmost label', () => {
    mutable.updatePoint(feature as any, labels[0], true);
    expect(feature.get('label')).toBe(labels[1]);
    expect(feature.get('color')).toBe(schemeTableau10[1].concat('cc'));
  });

  it('should remove all labels', () => {
    mutable.updatePoint(feature as any, labels[1], true);
    expect(feature.get('label')).toBe(undefined);
    expect(feature.get('color')).toBe(undefined);
  });

  it('should handle 3 labels', () => {
    mutable.updatePoint(feature as any, labels[0]);
    mutable.updatePoint(feature as any, labels[1]);
    mutable.updatePoint(feature as any, labels[2]);
    expect(feature.get('label')).toBe(labels.join(','));
    expect(feature.get('color')).toBe(schemeTableau10[2].concat('cc'));

    mutable.updatePoint(feature as any, labels[1], true);
    expect(feature.get('label')).toBe([labels[0], labels[2]].join(','));

    mutable.updatePoint(feature as any, labels[2], true);
    expect(feature.get('label')).toBe(labels[0]);
    expect(feature.get('color')).toBe(schemeTableau10[0].concat('cc'));
  });
});

describe('fresh start', () => {
  beforeEach(async () => {
    await runInit();
  });

  it('should add a point', () => {
    const idx = 0;
    mutable.add(idx, labels[0]);
    expect(mutable.source.getFeatureById(idx)!.getLabel()).toBe(labels[0]);
  });

  it('should add multiple points', () => {
    const idxs = [1, 2, 3, 4];
    mutable.add(idxs, labels[0]);
    for (const idx of idxs) {
      expect(mutable.source.getFeatureById(idx)!.getLabel()).toBe(labels[0]);
    }
  });
});

describe('circle test', () => {
  let oldCircle: TestFeatureLabel<TestCircle>;
  let newCircle: TestFeatureLabel<TestCircle>;

  beforeEach(async () => {
    await runInit();
    oldCircle = new TestFeatureLabel({ geometry: new TestCircle([0, 0], 0.501) });
    oldCircle.set('label', 'a');
    newCircle = new TestFeatureLabel({ geometry: new TestCircle([0, 0], 0.601) });
    newCircle.set('label', 'b');
  });

  it('should add and delete from polygon', () => {
    mutable.addFromPolygon(oldCircle as any);
    expect(mutable.length).toBe(6);
    expect(mutable.source.getFeatures().every((f) => f.getLabel())).toBe(true);

    mutable.addFromPolygon(newCircle as any);
    expect(mutable.length).toBe(7);
    expect(mutable.source.getFeatures().every((f) => f.getLabel() === 'b')).toBe(true);

    mutable.deleteFromPolygon(newCircle as any);
    expect(mutable.length).toBe(6);

    mutable.deleteFromPolygon(oldCircle as any);
    expect(mutable.length).toBe(0);

    mutable.addFromPolygon(oldCircle as any);
    mutable.addFromPolygon(oldCircle as any);
    expect(mutable.length).toBe(6);
  });

  it('should return correct composition', () => {
    mutable.addFromPolygon(newCircle as any);
    mutable.addFromPolygon(oldCircle as any);
    expect(mutable.getCounts()).toMatchObject({ a: 6, b: 1, total_: 7 });
  });

  it('should handle relabel', () => {
    mutable.addFromPolygon(oldCircle as any);
    mutable.addFromPolygon(newCircle as any);
    mutable.relabel('b', 'a');
    expect(mutable.getCounts()).toMatchObject({ a: 7, total_: 7 });
  });

  it('should handle relabel with no change', () => {
    mutable.addFromPolygon(newCircle as any);
    mutable.addFromPolygon(oldCircle as any);
    mutable.relabel('b', 'b');
    expect(mutable.getCounts()).toMatchObject({ a: 6, b: 1, total_: 7 });
  });

  it('should dump and load', () => {
    mutable.addFromPolygon(newCircle as any);
    mutable.addFromPolygon(oldCircle as any);
    const dump = mutable.dump();
    mutable.clear();
    expect(mutable.length).toBe(0);
    const rows = dump
      .split('\n')
      .slice(1)
      .filter(Boolean)
      .map((row) => {
        const [id, label] = row.split(',');
        return { id: Number(id), label };
      });
    mutable.load(rows, coordsData, overlaySource as any);
    expect(mutable.getCounts()).toMatchObject({ a: 6, b: 1, total_: 7 });
  });

  it('should clear', () => {
    mutable.addFromPolygon(newCircle as any);
    mutable.clear();
    expect(mutable.length).toBe(0);
    expect(mutable.coordsSource).toBeUndefined();
    expect(mutable.keyMap).toBeUndefined();
  });

  it('should keep points when clear prompt cancelled', () => {
    mutable.addFromPolygon(newCircle as any);
    const promptSpy = vi.spyOn(globalThis, 'prompt').mockReturnValueOnce('');
    const before = mutable.length;
    mutable.clear();
    expect(mutable.length).toBe(before);
    promptSpy.mockRestore();
  });
});

describe('preview and modify flows', () => {
  beforeEach(async () => {
    await runInit();
  });

  it('applies preview style to matching labels', async () => {
    await ready;
    mutable.add(0, labels[0]);
    const styleSpy = vi.spyOn(MutableSpotsClass, 'genPointStyle');
    styleSpy.mockClear();

    mutable.previewPoints(labels[0]);

    expect(styleSpy).toHaveBeenCalledWith(expect.any(String), 'star', true);
    styleSpy.mockRestore();
  });

  it('removes labels outside modified polygon', () => {
    const polygon = new TestFeatureLabel({ geometry: new TestCircle([0, 0], 0.6) });
    polygon.set('label', labels[0]);
    mutable.addFromPolygon(polygon as any);
    expect(mutable.getCounts()).toMatchObject({ a: 6, total_: 6 });

    mutable.modifyFromPolygon(polygon as any, []);
    const counts = mutable.getCounts();
    expect(counts.total_).toBe(0);
    expect(counts.unlabeled_).toBe(coordsData.pos!.length);
  });
});
