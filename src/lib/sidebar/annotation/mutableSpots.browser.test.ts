import { CoordsData } from '$src/lib/data/objects/coords';
import type { FeatureLabel } from '$src/lib/sidebar/annotation/annoUtils';
import { MutableSpots } from '$src/lib/sidebar/annotation/mutableSpots';
import { renderMappHarness } from '$src/lib/testing/mappFixture';
import { schemeTableau10 } from 'd3';
import Feature from 'ol/Feature.js';
import Circle from 'ol/geom/Circle.js';
import Point from 'ol/geom/Point.js';
import Polygon from 'ol/geom/Polygon.js';
import VectorSource from 'ol/source/Vector.js';
import { afterEach, expect, test, vi } from 'vitest';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const stubAlert = vi.fn();
const stubPrompt = vi.fn(() => 'ok');

function buildOverlaySource(coords: CoordsData) {
  const overlay = new VectorSource();
  coords.pos!.forEach(({ x, y }, idx) => {
    const feature = new Feature(new Point([x * coords.mPerPx, -y * coords.mPerPx]));
    feature.setId(idx);
    overlay.addFeature(feature);
  });
  return overlay;
}

async function setupMutable({
  coords,
  keyMap = { Tumor: 0, Stroma: 1 }
}: {
  coords: CoordsData;
  keyMap?: Record<string, number>;
}) {
  const overlaySource = buildOverlaySource(coords);
  const { map, cleanup } = await renderMappHarness({ coords });
  const mutable = new MutableSpots(map).mount();
  mutable.startDraw(coords, keyMap, overlaySource);
  return { mutable, overlaySource, map, cleanup, coords };
}

afterEach(() => {
  vi.restoreAllMocks();
});

vi.stubGlobal('alert', stubAlert);
vi.stubGlobal('prompt', stubPrompt);

function featureAt<T extends Point | Circle>(mutable: MutableSpots, idx: number) {
  return mutable.source.getFeatureById(idx) as FeatureLabel<T> | undefined;
}

test('MutableSpots add applies label stack and colour, removal clears it', async () => {
  const coords = new CoordsData({
    name: 'mutable-add',
    shape: 'circle',
    mPerPx: 1,
    size: 6,
    pos: [
      { x: 0, y: 0 },
      { x: 4, y: -2 }
    ]
  });

  const { mutable, cleanup, map } = await setupMutable({ coords });

  mutable.add(0, 'Tumor');
  mutable.add(0, 'Stroma');
  await flush();

  const feature = featureAt<Point>(mutable, 0);
  expect(feature?.getLabel()).toBe('Stroma');
  expect(feature?.get('label')).toBe('Tumor,Stroma');
  expect(feature?.get('color')).toBe(`${schemeTableau10[1]}cc`);

  mutable.updatePoint(feature as any, 'Stroma', true);
  await flush();
  expect(feature?.getLabel()).toBe('Tumor');
  mutable.updatePoint(feature as any, 'Tumor', true);
  expect(feature?.getLabel()).toBeUndefined();
  expect(feature?.get('color')).toBeUndefined();

  map.map?.removeInteraction(mutable.select);
  mutable.dispose?.();
  cleanup();
});

test('MutableSpots add accepts arrays and reports counts', async () => {
  const coords = new CoordsData({
    name: 'mutable-array',
    shape: 'circle',
    mPerPx: 1,
    size: 4,
    pos: Array.from({ length: 6 }, (_, idx) => ({ x: idx * 2, y: 0 }))
  });
  const keyMap = { Tumor: 0 };
  const { mutable, cleanup, map } = await setupMutable({ coords, keyMap });

  mutable.add([0, 1, 2, 3], 'Tumor');
  await flush();

  const labels = mutable.getAllPointsByLabel();
  expect(labels.Tumor).toEqual([0, 1, 2, 3]);
  expect(mutable.getCounts()).toMatchObject({ Tumor: 4, total_: 4, unlabeled_: 2 });

  map.map?.removeInteraction(mutable.select);
  mutable.dispose?.();
  cleanup();
});

test('MutableSpots replays polygons queued before startDraw', async () => {
  const coords = new CoordsData({
    name: 'mutable-pending-polygons',
    shape: 'circle',
    mPerPx: 1,
    size: 5,
    pos: Array.from({ length: 5 }, (_, idx) => ({ x: idx * 2, y: idx }))
  });
  const overlaySource = buildOverlaySource(coords);
  const { map, cleanup } = await renderMappHarness({ coords });
  const mutable = new MutableSpots(map).mount();

  const polygon = new Feature(new Circle([0, 0], 6));
  polygon.setId('poly-init');
  polygon.set('label', 'Tumor');

  mutable.addFromPolygon(polygon as any);
  expect(mutable.pendingPolygons).toHaveLength(1);

  mutable.startDraw(coords, { Tumor: 0 }, overlaySource);
  await flush();

  expect(mutable.pendingPolygons).toHaveLength(0);
  expect(featureAt<Circle>(mutable, 0)?.getLabel()).toBe('Tumor');

  map.map?.removeInteraction(mutable.select);
  mutable.dispose?.();
  cleanup();
});

test('MutableSpots polygon operations add, modify, delete and relabel', async () => {
  const coords = new CoordsData({
    name: 'mutable-poly',
    shape: 'circle',
    mPerPx: 1,
    size: 4,
    pos: [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 12, y: 0 },
      { x: 18, y: 0 },
      { x: 24, y: 0 }
    ]
  });
  const keyMap = { A: 0, B: 1 };
  const { mutable, cleanup, map } = await setupMutable({ coords, keyMap });

  const polyA = new Feature(new Circle([6, 0], 8));
  polyA.set('label', 'A');
  const polyB = new Feature(new Circle([18, 0], 6));
  polyB.set('label', 'B');

  mutable.addFromPolygon(polyA as any);
  await flush();
  expect(featureAt<Circle>(mutable, 0)?.getLabel()).toBe('A');
  expect(featureAt<Circle>(mutable, 2)?.getLabel()).toBe('A');
  expect(mutable.getCounts()).toMatchObject({ A: 3, total_: 3, unlabeled_: 2 });

  mutable.addFromPolygon(polyB as any);
  await flush();
  expect(featureAt<Circle>(mutable, 2)?.get('label')).toBe('A,B');
  expect(featureAt<Circle>(mutable, 4)?.getLabel()).toBe('B');

  mutable.modifyFromPolygon(polyB as any, [polyA as any]);
  await flush();
  const countsAfterModify = mutable.getCounts();
  expect(featureAt<Circle>(mutable, 4)?.getLabel()).toBeUndefined();
  expect(featureAt<Circle>(mutable, 2)?.getLabel()).toBe('B');
  expect(countsAfterModify.B ?? 0).toBeGreaterThan(0);

  mutable.deleteFromPolygon(polyB as any);
  await flush();
  const countsAfterDelete = mutable.getCounts();
  const labeledAfterDelete = countsAfterDelete.A ?? 0;
  expect(countsAfterDelete.B ?? 0).toBe(0);
  expect(featureAt<Circle>(mutable, 2)?.getLabel()).toBe('A');

  mutable.relabel('A', 'B');
  await flush();
  const countsAfterRelabel = mutable.getCounts();
  expect(countsAfterRelabel.B).toBe(labeledAfterDelete);
  expect(countsAfterRelabel.total_).toBe(labeledAfterDelete);
  expect(countsAfterRelabel.unlabeled_).toBe(coords.pos!.length - labeledAfterDelete);

  map.map?.removeInteraction(mutable.select);
  mutable.dispose?.();
  cleanup();
});

test('MutableSpots getCounts before startDraw should be safe', async () => {
  const coords = new CoordsData({
    name: 'mutable-before-start',
    shape: 'circle',
    mPerPx: 1,
    size: 4,
    pos: Array.from({ length: 4 }, (_, idx) => ({ x: idx * 2, y: 0 }))
  });

  const { map, cleanup } = await renderMappHarness({ coords });
  const mutable = new MutableSpots(map).mount();

  expect(() => mutable.getCounts()).not.toThrow();

  mutable.dispose?.();
  cleanup();
});

test('MutableSpots getCounts immediately after clear should not throw', async () => {
  const coords = new CoordsData({
    name: 'mutable-clear',
    shape: 'circle',
    mPerPx: 1,
    size: 4,
    pos: Array.from({ length: 3 }, (_, idx) => ({ x: idx * 2, y: 0 }))
  });
  const { mutable, cleanup, map } = await setupMutable({ coords });

  mutable.add([0, 1], 'Tumor');
  await flush();

  mutable.clear();

  expect(() => mutable.getCounts()).not.toThrow();

  map.map?.removeInteraction(mutable.select);
  mutable.dispose?.();
  cleanup();
});

test('MutableSpots addFromPolygon without coords should not crash', async () => {
  const coords = new CoordsData({
    name: 'mutable-import',
    shape: 'circle',
    mPerPx: 1,
    size: 4,
    pos: Array.from({ length: 5 }, (_, idx) => ({ x: idx * 3, y: idx }))
  });
  const { mutable, cleanup, map } = await setupMutable({ coords });

  mutable.clear();

  const polygon = new Polygon([
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0]
    ]
  ]);
  const polygonFeature = new Feature(polygon);
  polygonFeature.setId('poly-1');
  polygonFeature.set('label', 'Tumor');

  expect(() => mutable.addFromPolygon(polygonFeature)).not.toThrow();

  map.map?.removeInteraction(mutable.select);
  mutable.dispose?.();
  cleanup();
});

test('MutableSpots dump and load round trip', async () => {
  const coords = new CoordsData({
    name: 'mutable-dump',
    shape: 'circle',
    mPerPx: 1,
    size: 5,
    pos: Array.from({ length: 5 }, (_, idx) => ({ x: idx, y: idx }))
  });
  const { mutable, overlaySource, cleanup, map } = await setupMutable({ coords });

  mutable.add([0, 1, 2], 'Tumor');
  mutable.add(3, 'Stroma');
  await flush();

  const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('yes');
  const dump = mutable.dump();
  mutable.clear();
  expect(mutable.source.getFeatures()).toHaveLength(0);
  expect(mutable.coordsSource).toBeUndefined();

  const rows = dump
    .split('\n')
    .slice(1)
    .filter(Boolean)
    .map((row) => {
      const [id, label] = row.split(',');
      return { id: Number(id), label };
    });

  mutable.load(rows, coords, overlaySource as any);
  await flush();
  expect(mutable.getCounts()).toMatchObject({ Tumor: 3, Stroma: 1, total_: 4, unlabeled_: 1 });

  promptSpy.mockRestore();

  map.map?.removeInteraction(mutable.select);
  mutable.dispose?.();
  cleanup();
});

test('MutableSpots clear respects prompt cancellation and confirmation', async () => {
  const coords = new CoordsData({
    name: 'mutable-clear',
    shape: 'circle',
    mPerPx: 1,
    size: 4,
    pos: Array.from({ length: 3 }, (_, idx) => ({ x: idx, y: 0 }))
  });
  const { mutable, cleanup, map } = await setupMutable({ coords });

  mutable.add([0, 1], 'Tumor');
  await flush();

  const promptSpy = vi.spyOn(window, 'prompt').mockReturnValueOnce('');
  mutable.clear();
  expect(mutable.getCounts().total_).toBe(2);

  promptSpy.mockReturnValue('yes');
  mutable.clear();
  expect(mutable.source.getFeatures()).toHaveLength(0);
  expect(mutable.coordsSource).toBeUndefined();
  promptSpy.mockRestore();

  map.map?.removeInteraction(mutable.select);
  mutable.dispose?.();
  cleanup();
});

test('MutableSpots preview points toggles styles via OpenLayers', async () => {
  const coords = new CoordsData({
    name: 'mutable-preview',
    shape: 'circle',
    mPerPx: 1,
    size: 4,
    pos: Array.from({ length: 4 }, (_, idx) => ({ x: idx, y: idx }))
  });
  const { mutable, cleanup, map } = await setupMutable({ coords });
  mutable.add(0, 'Tumor');
  await flush();

  const spy = vi.spyOn(MutableSpots, 'genPointStyle');
  mutable.previewPoints('Tumor');
  expect(spy).toHaveBeenCalledWith(expect.any(String), 'outline', true);
  spy.mockRestore();

  map.map?.removeInteraction(mutable.select);
  mutable.dispose?.();
  cleanup();
});

test('MutableSpots select interaction deletes points with keyboard', async () => {
  const coords = new CoordsData({
    name: 'mutable-select',
    shape: 'circle',
    mPerPx: 1,
    size: 6,
    pos: [
      { x: 0, y: 0 },
      { x: 10, y: 0 }
    ]
  });

  const { mutable, cleanup, map } = await setupMutable({ coords });
  mutable.add([0, 1], 'Tumor');
  await flush();

  const feature = featureAt<Point>(mutable, 0)!;
  mutable.select.getFeatures().push(feature as any);
  mutable.select.dispatchEvent({
    type: 'select',
    selected: [feature],
    deselected: [],
    mapBrowserEvent: undefined
  } as any);
  await flush();

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
  await flush();

  expect(featureAt<Point>(mutable, 0)?.getLabel()).toBeUndefined();
  expect(featureAt<Point>(mutable, 1)?.getLabel()).toBe('Tumor');

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  map.map?.removeInteraction(mutable.select);
  mutable.dispose?.();
  cleanup();
});

test('MutableSpots removeByLabel clears matching features', async () => {
  const coords = new CoordsData({
    name: 'mutable-remove',
    shape: 'circle',
    mPerPx: 1,
    size: 4,
    pos: Array.from({ length: 4 }, (_, idx) => ({ x: idx * 3, y: 0 }))
  });
  const { mutable, cleanup, map } = await setupMutable({ coords });
  mutable.add([0, 1], 'Tumor');
  mutable.add(2, 'Stroma');
  await flush();

  mutable.removeByLabel('Tumor');
  await flush();
  expect(mutable.getCounts()).toMatchObject({ Stroma: 1, total_: 1, unlabeled_: 3 });
  expect(featureAt<Point>(mutable, 0)?.getLabel()).toBeUndefined();
  expect(featureAt<Point>(mutable, 2)?.getLabel()).toBe('Stroma');

  map.map?.removeInteraction(mutable.select);
  mutable.dispose?.();
  cleanup();
});
