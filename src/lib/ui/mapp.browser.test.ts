import { CoordsData } from '$src/lib/data/objects/coords';
import { renderMappHarness } from '$src/lib/testing/mappFixture';
import { CanvasSpots } from '$src/lib/ui/overlays/points';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import { expect, test } from 'vitest';

test('pointermove listeners receive active spot hits', async () => {
  const coords = new CoordsData({
    name: 'hover-targets',
    shape: 'circle',
    mPerPx: 1,
    size: 100,
    pos: [
      { x: -20, y: -20, id: 'first' },
      { x: 0, y: 0, id: 'second' }
    ]
  });

  const { map, cleanup } = await renderMappHarness({ coords, highlightIdx: 1 });

  let lastHover: { idx: number; id: number | string } | null | undefined;
  map.attachPointerListener(
    {
      pointermove(info) {
        lastHover = info;
      }
    },
    { layer: map.persistentLayers.active.layer }
  );

  const olMap = map.map!;
  const target = olMap.getViewport();

  const coordinate = [coords.pos![1].x * coords.mPerPx, -coords.pos![1].y * coords.mPerPx];
  olMap.getView().setCenter(coordinate);
  olMap.getView().setZoom(6);
  olMap.renderSync();

  const pixel = olMap.getPixelFromCoordinate(coordinate);
  if (!pixel) throw new Error('Pixel lookup failed');

  const rect = target.getBoundingClientRect();
  const clientX = rect.left + pixel[0];
  const clientY = rect.top + pixel[1];

  target.dispatchEvent(
    new PointerEvent('pointermove', {
      clientX,
      clientY,
      bubbles: true,
      pointerType: 'mouse'
    })
  );

  await expect.poll(() => lastHover?.id).toBe('second');
  expect(lastHover?.idx).toBe(1);
  cleanup();
});

test('canvas outline renders all coordinate features when shown', async () => {
  const coords = new CoordsData({
    name: 'outline',
    shape: 'circle',
    mPerPx: 1,
    size: 50,
    pos: [
      { x: 5, y: 5, id: 'a' },
      { x: -5, y: 5, id: 'b' },
      { x: 0, y: 0, id: 'c' }
    ]
  });

  const { map, cleanup } = await renderMappHarness({ coords });

  const outline = new CanvasSpots(map);
  outline.mount();
  outline.visible = true;
  outline.update(coords);

  expect(outline.source.getFeatures().length).toBe(coords.pos!.length);
  expect(map.map!.getLayers().getArray()).toContain(outline.layer);
  cleanup();
});

test('pointer listeners can read feature intensity values from OpenLayers layers', async () => {
  const coords = new CoordsData({
    name: 'intensity',
    shape: 'circle',
    mPerPx: 1,
    size: 10,
    pos: [{ x: 12, y: -8, id: 'spot-1' }]
  });

  const { map, cleanup } = await renderMappHarness({ coords, highlightIdx: 0 });

  const source = new VectorSource();
  const layer = new VectorLayer({ source });
  const feature = new Feature({
    geometry: new Point([coords.pos![0].x * coords.mPerPx, -coords.pos![0].y * coords.mPerPx])
  });
  feature.setId(0);
  feature.set('value', 123.45);
  source.addFeature(feature);

  map.map!.addLayer(layer);

  let sampledValue: number | undefined;
  map.attachPointerListener(
    {
      pointermove(info) {
        sampledValue = info?.feature.get('value');
      }
    },
    { layer }
  );

  const olMap = map.map!;
  const target = olMap.getViewport();
  const coordinate = [coords.pos![0].x * coords.mPerPx, -coords.pos![0].y * coords.mPerPx];
  olMap.getView().setCenter(coordinate);
  olMap.getView().setZoom(6);
  olMap.renderSync();

  const pixel = olMap.getPixelFromCoordinate(coordinate);
  if (!pixel) throw new Error('Pixel lookup failed');
  const rect = target.getBoundingClientRect();
  const clientX = rect.left + pixel[0];
  const clientY = rect.top + pixel[1];
  target.dispatchEvent(
    new PointerEvent('pointermove', {
      clientX,
      clientY,
      bubbles: true,
      pointerType: 'mouse'
    })
  );

  await expect.poll(() => sampledValue).toBeCloseTo(123.45, 2);

  map.map!.removeLayer(layer);
  cleanup();
});
