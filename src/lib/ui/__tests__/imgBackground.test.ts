import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockMap } from '$src/test/ol-helpers';

const geoTiffInstances: Array<{ options: any; dispose: ReturnType<typeof vi.fn>; bandCount: number }> = [];
const layerInstances: Array<{
  options: any;
  updateStyleVariables: ReturnType<typeof vi.fn>;
  setVisible: ReturnType<typeof vi.fn>;
  getVisible: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}> = [];

const GeoTIFFMock = vi.fn((options) => {
  const instance = { options, dispose: vi.fn(), bandCount: 0 };
  geoTiffInstances.push(instance);
  return instance;
});

const WebGLTileLayerMock = vi.fn((options) => {
  const instance = {
    options,
    updateStyleVariables: vi.fn(),
    setVisible: vi.fn(),
    getVisible: vi.fn(() => true),
    dispose: vi.fn()
  };
  layerInstances.push(instance);
  return instance;
});

const genCompStyle = vi.fn(() => ({ id: 'comp-style' }));
const genRGBStyle = vi.fn(() => ({ id: 'rgb-style' }));
const decomposeColors = vi.fn(() => ({ decomposed: true }));

vi.mock('ol/source/GeoTIFF', () => ({ default: GeoTIFFMock }));
vi.mock('ol/layer/WebGLTile', () => ({ default: WebGLTileLayerMock }));
vi.mock('../background/imgColormap', () => ({
  genCompStyle,
  genRGBStyle,
  decomposeColors
}));

const storageMock = {
  setItem: vi.fn(),
  getItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

Object.defineProperty(globalThis, 'localStorage', {
  value: storageMock,
  configurable: true
});

describe('Background', () => {
  beforeEach(() => {
    vi.resetModules();
    GeoTIFFMock.mockClear();
    WebGLTileLayerMock.mockClear();
    genCompStyle.mockClear();
    genRGBStyle.mockClear();
    decomposeColors.mockClear();
    storageMock.setItem.mockClear();
    geoTiffInstances.length = 0;
    layerInstances.length = 0;
  });

  const loadModule = async () => {
    const mod = await import('../background/imgBackground');
    return mod;
  };

  it('update attaches a GeoTIFF source and WebGL layer for composite imagery', async () => {
    const { Background } = await loadModule();
    const map = createMockMap();
    const image = {
      promise: Promise.resolve(),
      urls: [{ url: 'http://example.com/tiles/0' }],
      channels: ['r', 'g'],
      mode: 'composite' as const,
      maxVal: 2048,
      mPerPx: 1
    };

    const background = new Background();
    await background.update(map as any, image as any);

    expect(GeoTIFFMock).toHaveBeenCalledWith({
      normalize: false,
      sources: [{ url: 'http://example.com/tiles/0' }]
    });
    expect(genCompStyle).toHaveBeenCalledWith(image.channels, 1024);
    expect(WebGLTileLayerMock).toHaveBeenCalledWith({
      style: { id: 'comp-style' },
      source: geoTiffInstances.at(-1),
      zIndex: -1
    });
    expect(map.addLayer).toHaveBeenCalledWith(layerInstances.at(-1));
    expect(background.mPerPx).toBe(1);
    expect(geoTiffInstances.at(-1)?.bandCount).toBe(image.channels.length);
  });

  it('update uses RGB styling when mode is rgb', async () => {
    const { Background } = await loadModule();
    const map = createMockMap();
    const image = {
      promise: Promise.resolve(),
      urls: [{ url: 'http://example.com/tiles/1' }],
      channels: 'rgb',
      mode: 'rgb' as const,
      maxVal: 512,
      mPerPx: 2
    };

    const background = new Background();
    background.image = image as any;
    await background.update(map as any, image as any);

    expect(genRGBStyle).toHaveBeenCalledTimes(1);
    expect(genCompStyle).not.toHaveBeenCalled();
    expect(geoTiffInstances.at(-1)?.bandCount).toBe(3);
  });

  it('updateStyle persists controls and delegates to _updateStyle for composite data', async () => {
    const { Background } = await loadModule();
    const background = new Background();
    background.image = {
      channels: ['one', 'two'],
      mode: 'composite'
    } as any;
    const spy = vi.spyOn(background as any, '_updateStyle');

    const ctrl = {
      type: 'composite' as const,
      variables: {
        one: { enabled: true, color: 'red', minmax: [0, 1] },
        two: { enabled: false, color: 'green', minmax: [2, 3] }
      }
    };

    background.updateStyle(ctrl);
    (background.updateStyle as any).flush?.();

    expect(storageMock.setItem).toHaveBeenCalledWith('imgCtrl', JSON.stringify(ctrl));
    expect(decomposeColors).toHaveBeenCalledWith(['one', 'two'], ctrl);
    expect(spy).toHaveBeenCalledWith({ decomposed: true });
  });

  it('updateStyle forwards rgb controls as-is', async () => {
    const { Background } = await loadModule();
    const background = new Background();
    background.image = { mode: 'rgb' } as any;
    const spy = vi.spyOn(background as any, '_updateStyle');

    const ctrl = { type: 'rgb' as const, Exposure: 1, Contrast: 2, Saturation: 3 };
    background.updateStyle(ctrl);
    (background.updateStyle as any).flush?.();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ Exposure: 1, Contrast: 2, Saturation: 3 })
    );
  });

  it('dispose removes layers and releases resources', async () => {
    const { Background } = await loadModule();
    const map = createMockMap();
    const background = new Background();
    background.layer = WebGLTileLayerMock({}) as any;
    background.source = GeoTIFFMock({}) as any;

    background.dispose(map as any);

    expect(map.removeLayer).toHaveBeenCalledWith(background.layer);
    expect(background.layer.dispose).toHaveBeenCalledTimes(1);
    expect(background.source.dispose).toHaveBeenCalledTimes(1);
  });
});
