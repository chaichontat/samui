import { vi } from 'vitest';

export const createMockMap = () => {
  const controls: unknown[] = [{}];
  const layers: unknown[] = [];
  const events = new Map<string, (arg: any) => void>();
  const view = {
    getZoom: vi.fn(() => 3),
    animate: vi.fn()
  };

  const mapObj: any = {
    controls,
    overlays: [],
    events,
    addControl: vi.fn((ctrl: unknown) => controls.push(ctrl)),
    removeControl: vi.fn((ctrl: unknown) => {
      const idx = controls.indexOf(ctrl);
      if (idx >= 0) controls.splice(idx, 1);
    }),
    on: vi.fn((event: string, handler: (arg: any) => void) => {
      events.set(event, handler);
    }),
    once: vi.fn(),
    addOverlay: vi.fn(),
    removeOverlay: vi.fn(),
    getControls: vi.fn(() => ({ getArray: () => controls })),
    getLayers: vi.fn(() => ({
      getArray: () => layers,
      insertAt: vi.fn((index: number, layer: unknown) => {
        layers.splice(index, 0, layer);
      }),
      remove: vi.fn((layer: unknown) => {
        const idx = layers.indexOf(layer);
        if (idx >= 0) layers.splice(idx, 1);
      })
    })),
    getView: vi.fn(() => view),
    updateSize: vi.fn(),
    setView: vi.fn(),
    forEachFeatureAtPixel: vi.fn(),
    addInteraction: vi.fn(),
    removeInteraction: vi.fn(),
    addLayer: vi.fn((layer: unknown) => layers.push(layer)),
    removeLayer: vi.fn((layer: unknown) => {
      const idx = layers.indexOf(layer);
      if (idx >= 0) layers.splice(idx, 1);
    }),
    map: undefined as unknown
  };
  mapObj.map = mapObj;
  return mapObj;
};

export const createMockOverlay = () => ({
  mount: vi.fn(),
  updateSample: vi.fn(() => Promise.resolve()),
  layer: undefined,
  uid: `overlay-${Math.random().toString(36).slice(2)}`,
  currFeature: undefined,
  update: vi.fn(),
  dispose: vi.fn(),
  visible: true
});

export const withOpenLayersMocks = () => {
  const map = createMockMap();
  const Map = vi.fn(() => map);
  const Overlay = vi.fn(() => ({}));
  const View = vi.fn();

  vi.doMock('ol', () => ({ Map, Overlay, View }));
  vi.doMock('ol/control/Zoom.js', () => ({ default: vi.fn() }));
  vi.doMock('ol/control/ScaleLine.js', () => ({ default: vi.fn() }));

  return { map, Map, Overlay, View };
};
