import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fromUrl: vi.fn()
}));

vi.mock('geotiff', () => ({
  fromUrl: mocks.fromUrl
}));

import { ImgData } from '$src/lib/data/objects/image';

import { estimateCompositeMinMax, estimatePercentileWindow } from './imgIntensity';

function createGeoTiffStub({
  width = 1000,
  height = 500,
  samplesPerPixel = 1,
  rasters
}: {
  height?: number;
  rasters: ArrayLike<number> | Array<ArrayLike<number>>;
  samplesPerPixel?: number;
  width?: number;
}) {
  const image = {
    getHeight: vi.fn(() => height),
    getSamplesPerPixel: vi.fn(() => samplesPerPixel),
    getWidth: vi.fn(() => width),
    readRasters: vi.fn(async () => rasters)
  };

  return {
    getImage: vi.fn(async () => image)
  };
}

beforeEach(() => {
  mocks.fromUrl.mockReset();
  vi.unstubAllGlobals();
});

describe('estimatePercentileWindow', () => {
  it('computes 1-99 percentile windows without sorting the full image', () => {
    const values = Uint16Array.from({ length: 100 }, (_, index) => index);

    expect(estimatePercentileWindow(values, 65535)).toEqual([0, 98]);
  });

  it('does not allocate an enormous histogram when values contain an extreme outlier', () => {
    const RealUint32Array = Uint32Array;

    class GuardedUint32Array extends RealUint32Array {
      constructor(
        input: number | ArrayBufferLike | ArrayLike<number>,
        byteOffset?: number,
        length?: number
      ) {
        if (typeof input === 'number' && input > 65536) {
          throw new Error(`oversized histogram: ${input}`);
        }

        if (typeof input === 'number' || Array.isArray(input) || ArrayBuffer.isView(input)) {
          super(input);
          return;
        }

        if (byteOffset == null) {
          super(input);
        } else if (length == null) {
          super(input, byteOffset);
        } else {
          super(input, byteOffset, length);
        }
      }
    }

    vi.stubGlobal('Uint32Array', GuardedUint32Array);

    expect(() => estimatePercentileWindow([0, 1, 2, 1_000_000_000], 1_000_000_000)).not.toThrow();
    expect(estimatePercentileWindow([0, 1, 2, 1_000_000_000], 1_000_000_000)).toEqual([0, 2]);
  });

  it('does not size the histogram directly from an oversized declared max', () => {
    const RealUint32Array = Uint32Array;

    class GuardedUint32Array extends RealUint32Array {
      constructor(
        input: number | ArrayBufferLike | ArrayLike<number>,
        byteOffset?: number,
        length?: number
      ) {
        if (typeof input === 'number' && input > 1000) {
          throw new Error(`oversized histogram: ${input}`);
        }

        if (typeof input === 'number' || Array.isArray(input) || ArrayBuffer.isView(input)) {
          super(input);
          return;
        }

        if (byteOffset == null) {
          super(input);
        } else if (length == null) {
          super(input, byteOffset);
        } else {
          super(input, byteOffset, length);
        }
      }
    }

    vi.stubGlobal('Uint32Array', GuardedUint32Array);

    expect(() => estimatePercentileWindow(Uint16Array.of(0, 1, 2), 5000)).not.toThrow();
    expect(estimatePercentileWindow(Uint16Array.of(0, 1, 2), 5000)).toEqual([0, 1]);
  });

  it('falls back to the image max when no samples are available', () => {
    expect(estimatePercentileWindow(new Uint16Array(), 4095)).toEqual([0, 4095]);
  });
});

describe('estimateCompositeMinMax', () => {
  it('reads one multiband TIFF once at reduced resolution', async () => {
    const tiff = createGeoTiffStub({
      samplesPerPixel: 2,
      rasters: [
        Uint16Array.from({ length: 100 }, (_, index) => index),
        Uint16Array.from({ length: 100 }, (_, index) => 200 + index)
      ]
    });
    mocks.fromUrl.mockResolvedValueOnce(tiff);

    const image = new ImgData({
      urls: [{ url: 'blob:multi', type: 'network' }],
      channels: ['C1', 'C2'],
      mPerPx: 1,
      maxVal: 4095
    });

    const ranges = await estimateCompositeMinMax(image);

    expect(ranges).toEqual({
      C1: [0, 98],
      C2: [200, 298]
    });
    expect(tiff.getImage).toHaveBeenCalledTimes(1);
    const imageStub = await tiff.getImage.mock.results[0].value;
    expect(imageStub.readRasters).toHaveBeenCalledWith({
      width: 256,
      height: 128,
      samples: [0, 1],
      interleave: false
    });
  });

  it('reads one single-band TIFF per channel when urls are split', async () => {
    const first = createGeoTiffStub({
      rasters: Uint16Array.from({ length: 100 }, (_, index) => index)
    });
    const second = createGeoTiffStub({
      rasters: Uint16Array.from({ length: 100 }, (_, index) => 1000 + index)
    });
    mocks.fromUrl.mockResolvedValueOnce(first).mockResolvedValueOnce(second);

    const image = new ImgData({
      urls: [
        { url: 'blob:c1', type: 'network' },
        { url: 'blob:c2', type: 'network' }
      ],
      channels: ['C1', 'C2'],
      mPerPx: 1,
      maxVal: 4095
    });

    const ranges = await estimateCompositeMinMax(image);

    expect(ranges).toEqual({
      C1: [0, 98],
      C2: [1000, 1098]
    });
  });
});
