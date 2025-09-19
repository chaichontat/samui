import { CoordsData } from '$src/lib/data/objects/coords';
import { renderMappHarness } from '$src/lib/testing/mappFixture';
import { ActiveSpots, CanvasSpots } from '$src/lib/ui/overlays/points';
import Circle from 'ol/geom/Circle.js';
import { expect, test } from 'vitest';

const wait = () => new Promise((resolve) => setTimeout(resolve, 0));

test('ActiveSpots draws circle for selected coordinate', async () => {
  const coords = new CoordsData({
    name: 'active-spots',
    shape: 'circle',
    mPerPx: 2,
    size: 6,
    pos: [
      { x: 10, y: 5, id: 'first', idx: 0 },
      { x: -3, y: -8, id: 'second', idx: 1 }
    ]
  });

  const { map, cleanup } = await renderMappHarness({ coords, highlightIdx: 0 });

  const active = new ActiveSpots(map);
  active.mount();
  await map.promise;

  active.update(coords, 1);

  const geometry = active.feature.getGeometry() as Circle;
  expect(geometry.getCenter()).toEqual([-6, 16]);
  expect(geometry.getRadius()).toBeCloseTo(coords.size! / 2, 6);
  expect(active.feature.get('id')).toBe('second');
  expect(map.map!.getLayers().getArray()).toContain(active.layer);

  active.dispose();
  cleanup();
});

test('CanvasSpots populates features only when visible and respects large datasets', async () => {
  const coords = new CoordsData({
    name: 'canvas-spots',
    shape: 'circle',
    mPerPx: 1,
    size: 4,
    pos: [
      { x: 0, y: 0, id: 'origin', idx: 0 },
      { x: 5, y: -5, id: 'diag', idx: 1 }
    ]
  });

  const { map, cleanup } = await renderMappHarness({ coords });

  const canvas = new CanvasSpots(map);
  canvas.mount();
  canvas.visible = false;

  canvas.update(coords);
  expect(canvas.source.getFeatures()).toHaveLength(0);

  canvas.visible = true;
  await wait();
  expect(canvas.source.getFeatures()).toHaveLength(coords.pos!.length);

  const manyCoords = new CoordsData({
    name: 'many',
    shape: 'circle',
    mPerPx: 1,
    size: 4,
    pos: Array.from({ length: 15000 }, (_, idx) => ({ x: idx, y: idx, idx }))
  });

  canvas.update(manyCoords as any);
  expect(canvas.source.getFeatures()).toHaveLength(0);

  canvas.dispose();
  cleanup();
});
