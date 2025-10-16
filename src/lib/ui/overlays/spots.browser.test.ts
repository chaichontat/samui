import { CoordsData } from '$src/lib/data/objects/coords';
import type { Sample } from '$src/lib/data/objects/sample';
import { renderMappHarness } from '$src/lib/testing/mappFixture';
import { ActiveSpots, CanvasSpots, WebGLSpots } from '$src/lib/ui/overlays/points';
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

test('WebGLSpots rebuilds geometry when a new sample with the same name is loaded', async () => {
  const feature = { group: 'group-1', feature: 'feat-1' } as const;
  const coordsOne = new CoordsData({
    name: 'shared-coords',
    shape: 'circle',
    mPerPx: 1,
    size: 5,
    pos: [
      { x: 0, y: 0, id: 'first-0' },
      { x: 2, y: 3, id: 'first-1' }
    ]
  });

  const { map, cleanup } = await renderMappHarness({ coords: coordsOne });
  const overlay = new WebGLSpots(map);

  const createSample = (coords: CoordsData): Sample =>
    ({
      name: 'duplicate-name',
      async getFeature() {
        const values = coords.pos!.map((_, idx) => idx);
        return {
          data: values,
          dataType: 'quantitative' as const,
          coords,
          minmax: [0, values.length - 1] as [number, number],
          unit: 'a.u.',
          name: feature
        };
      }
    }) as unknown as Sample;

  const sampleOne = createSample(coordsOne);
  await overlay.update(sampleOne, feature);
  await wait();

  const firstGeometry = overlay.source.getFeatures()[0]!.getGeometry()?.getCoordinates();

  const coordsTwo = new CoordsData({
    name: 'shared-coords',
    shape: 'circle',
    mPerPx: 0.5,
    size: 5,
    pos: [
      { x: 20, y: 4, id: 'second-0' },
      { x: 25, y: -8, id: 'second-1' }
    ]
  });

  const sampleTwo = createSample(coordsTwo);
  await overlay.update(sampleTwo, feature);
  await wait();

  const expected = [
    coordsTwo.pos![0].x * coordsTwo.mPerPx,
    -coordsTwo.pos![0].y * coordsTwo.mPerPx
  ];
  const updatedGeometry = overlay.source.getFeatures()[0]!.getGeometry()?.getCoordinates();

  expect(firstGeometry).not.toEqual(expected);
  expect(updatedGeometry).toEqual(expected);
  expect(overlay.coords).toBe(coordsTwo);
  expect(overlay.currPx).toBeCloseTo(coordsTwo.sizePx);

  overlay.dispose();
  cleanup();
});
