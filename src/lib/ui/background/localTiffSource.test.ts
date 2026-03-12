import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fromUrl: vi.fn()
}));

vi.mock('geotiff', () => ({
  fromUrl: mocks.fromUrl,
  addDecoder: vi.fn(),
  BaseDecoder: class {}
}));

import { ImgData } from '$src/lib/data/objects/image';
import {
  buildLocalTiffViewOptions,
  createLocalTiffSource
} from '$src/lib/ui/background/localTiffSource';
import type TileGrid from 'ol/tilegrid/TileGrid.js';

type Loader = (
  z: number,
  x: number,
  y: number,
  options: { signal?: AbortSignal }
) => Promise<ArrayLike<number>>;

function getLoader(source: unknown) {
  return (source as { loader_: Loader }).loader_;
}

function getTileGrid(source: unknown) {
  return (source as { getTileGrid(): TileGrid | null }).getTileGrid();
}

function createBand(width: number, height: number, offset = 0) {
  const values = new Uint16Array(width * height);
  for (let index = 0; index < values.length; index += 1) {
    values[index] = offset + index;
  }
  return values;
}

function createImageStub(
  width: number,
  height: number,
  bands: Uint16Array[],
  samplesPerPixel = bands.length
) {
  return {
    getWidth: vi.fn(() => width),
    getHeight: vi.fn(() => height),
    getSamplesPerPixel: vi.fn(() => samplesPerPixel),
    readRasters: vi.fn(async ({ samples }: { samples?: number[] }) => {
      if (!samples) {
        return bands;
      }

      return samples.map((sampleIndex) => bands[sampleIndex]!);
    })
  };
}

beforeEach(() => {
  mocks.fromUrl.mockReset();
});

describe('buildLocalTiffViewOptions', () => {
  it('builds a pixel-space view centered on the TIFF extent without GeoTIFF source metadata', () => {
    const view = buildLocalTiffViewOptions({
      channels: ['C1', 'C2'],
      maxVal: 65535,
      mPerPx: 2,
      renderMode: 'local-tiff',
      size: { width: 300, height: 120 },
      urls: []
    });

    expect(view.center).toEqual([300, -120]);
    expect(view.extent).toEqual([0, -240, 600, 0]);
    expect(view.showFullExtent).toBe(true);
    expect(view.resolutions).toEqual([8, 4, 2, 1, 0.5]);
  });

  it('adds intermediate zoom resolutions for large TIFFs instead of jumping from overview to native', () => {
    const view = buildLocalTiffViewOptions({
      channels: ['C1', 'C2'],
      maxVal: 65535,
      mPerPx: 1,
      renderMode: 'local-tiff',
      size: { width: 4096, height: 2048 },
      urls: []
    });

    expect(view.resolutions).toEqual([32, 16, 8, 4, 2, 1, 0.5, 0.25]);
  });
});

describe('createLocalTiffSource', () => {
  it('uses the native TIFF image at higher zoom levels', async () => {
    const imageStub = createImageStub(2048, 1024, [
      createBand(2048, 1024),
      createBand(2048, 1024, 5000)
    ]);
    mocks.fromUrl.mockResolvedValue({
      getImage: vi.fn(async () => imageStub)
    });

    const image = new ImgData({
      urls: [{ url: 'blob:multi-band', type: 'network' }],
      channels: ['C1', 'C2'],
      renderMode: 'local-tiff',
      size: { width: 2048, height: 1024 },
      mPerPx: 1,
      maxVal: 65535
    });

    const source = await createLocalTiffSource(image);
    const loader = getLoader(source);
    const z = getTileGrid(source)!.getZForResolution(1);
    await loader(z, 0, 0, {});

    expect(imageStub.readRasters).toHaveBeenCalledTimes(1);
    expect(imageStub.readRasters).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 256,
        height: 256,
        samples: [0, 1]
      })
    );
  });

  it('builds the first overview once and reuses it for repeated zoomed-out tiles', async () => {
    const imageStub = createImageStub(2048, 1024, [
      createBand(1024, 512),
      createBand(1024, 512, 1000)
    ]);
    mocks.fromUrl.mockResolvedValue({
      getImage: vi.fn(async () => imageStub)
    });

    const image = new ImgData({
      urls: [{ url: 'blob:multi-band', type: 'network' }],
      channels: ['C1', 'C2'],
      renderMode: 'local-tiff',
      size: { width: 2048, height: 1024 },
      mPerPx: 1,
      maxVal: 65535
    });

    const source = await createLocalTiffSource(image);
    const loader = getLoader(source);
    const z = getTileGrid(source)!.getZForResolution(4);
    const firstTile = await loader(z, 0, 0, {});
    await loader(z, 1, 0, {});

    expect(imageStub.readRasters).toHaveBeenCalledTimes(1);
    expect(imageStub.readRasters).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 1024,
        height: 512,
        samples: [0, 1]
      })
    );
    const preview = Array.from(firstTile).slice(0, 4);
    expect(preview[1]! - preview[0]!).toBeCloseTo(1000, 5);
    expect(preview[3]! - preview[2]!).toBeCloseTo(1000, 5);
  });

  it('prefers native data when the requested resolution is finer than the overview level', async () => {
    const imageStub = createImageStub(4096, 2048, [
      createBand(4096, 2048),
      createBand(4096, 2048, 5000)
    ]);
    mocks.fromUrl.mockResolvedValue({
      getImage: vi.fn(async () => imageStub)
    });

    const image = new ImgData({
      urls: [{ url: 'blob:multi-band', type: 'network' }],
      channels: ['C1', 'C2'],
      renderMode: 'local-tiff',
      size: { width: 4096, height: 2048 },
      mPerPx: 8,
      maxVal: 65535
    });

    const source = await createLocalTiffSource(image);
    const loader = getLoader(source);
    const z = getTileGrid(source)!.getZForResolution(2);
    await loader(z, 0, 0, {});

    expect(imageStub.readRasters).toHaveBeenCalledTimes(1);
    expect(imageStub.readRasters).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 256,
        height: 256,
        samples: [0, 1]
      })
    );
  });

  it('builds the coarsest overview from the first overview instead of rereading the native TIFF', async () => {
    const imageStub = createImageStub(2048, 1024, [
      createBand(1024, 512),
      createBand(1024, 512, 1000)
    ]);
    mocks.fromUrl.mockResolvedValue({
      getImage: vi.fn(async () => imageStub)
    });

    const image = new ImgData({
      urls: [{ url: 'blob:multi-band', type: 'network' }],
      channels: ['C1', 'C2'],
      renderMode: 'local-tiff',
      size: { width: 2048, height: 1024 },
      mPerPx: 1,
      maxVal: 65535
    });

    const source = await createLocalTiffSource(image);
    const loader = getLoader(source);
    const overviewZ = getTileGrid(source)!.getZForResolution(4);
    const coarseZ = getTileGrid(source)!.getZForResolution(16);
    await loader(overviewZ, 0, 0, {});
    await loader(coarseZ, 0, 0, {});

    expect(imageStub.readRasters).toHaveBeenCalledTimes(1);
  });

  it('preserves split-page channel ordering through overview generation', async () => {
    const firstPage = createImageStub(2048, 1024, [createBand(1024, 512)]);
    const secondPage = createImageStub(2048, 1024, [createBand(1024, 512, 1000)]);
    mocks.fromUrl
      .mockResolvedValueOnce({ getImage: vi.fn(async () => firstPage) })
      .mockResolvedValueOnce({ getImage: vi.fn(async () => secondPage) });

    const image = new ImgData({
      urls: [
        { url: 'blob:c1', type: 'network' },
        { url: 'blob:c2', type: 'network' }
      ],
      channels: ['C1', 'C2'],
      renderMode: 'local-tiff',
      size: { width: 2048, height: 1024 },
      mPerPx: 1,
      maxVal: 65535
    });

    const source = await createLocalTiffSource(image);
    const loader = getLoader(source);
    const z = getTileGrid(source)!.getZForResolution(4);
    const tile = await loader(z, 0, 0, {});

    expect(firstPage.readRasters).toHaveBeenCalledTimes(1);
    expect(secondPage.readRasters).toHaveBeenCalledTimes(1);
    const preview = Array.from(tile).slice(0, 4);
    expect(preview[1]! - preview[0]!).toBeCloseTo(1000, 5);
    expect(preview[3]! - preview[2]!).toBeCloseTo(1000, 5);
  });
});
