import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GeoTIFF, GeoTIFFImage } from 'geotiff';

const mocks = vi.hoisted(() => ({
  addDecoder: vi.fn(),
  fromBlob: vi.fn()
}));

vi.mock('geotiff', () => ({
  BaseDecoder: class {
    constructor(public parameters: unknown) {}
  },
  addDecoder: mocks.addDecoder,
  fromBlob: mocks.fromBlob
}));

import { buildTiffImageParams, buildTiffSampleParams } from './tiffImport';

type ImageStub = Pick<
  GeoTIFFImage,
  | 'getBitsPerSample'
  | 'getHeight'
  | 'getFileDirectory'
  | 'getGDALMetadata'
  | 'getGeoKeys'
  | 'getResolution'
  | 'getSampleFormat'
  | 'getSamplesPerPixel'
  | 'getWidth'
>;

function createImageStub({
  bitsPerSample = 8,
  gdalMetadata,
  geoKeys = null,
  height = 10,
  photometricInterpretation = 1,
  resolution,
  sampleFormat = 1,
  samplesPerPixel = 1,
  width = 10
}: {
  bitsPerSample?: number;
  gdalMetadata?: Record<number | 'dataset', Record<string, unknown> | null>;
  geoKeys?: ReturnType<GeoTIFFImage['getGeoKeys']>;
  height?: number;
  photometricInterpretation?: number;
  resolution?: [number, number, number?];
  sampleFormat?: number;
  samplesPerPixel?: number;
  width?: number;
} = {}): ImageStub {
  return {
    getBitsPerSample: vi.fn(() => bitsPerSample),
    getHeight: vi.fn(() => height),
    getFileDirectory: vi.fn(
      () =>
        ({
          getValue: (tag: string) =>
            tag === 'PhotometricInterpretation' ? photometricInterpretation : undefined
        }) as unknown as ReturnType<GeoTIFFImage['getFileDirectory']>
    ),
    getGDALMetadata: vi.fn(async (sample: number | null = null) => {
      const key = sample == null ? 'dataset' : sample;
      return gdalMetadata?.[key] ?? null;
    }),
    getGeoKeys: vi.fn(() => geoKeys),
    getResolution: vi.fn(() => {
      if (!resolution) {
        throw new Error('no resolution');
      }
      return resolution;
    }),
    getSampleFormat: vi.fn(() => sampleFormat),
    getSamplesPerPixel: vi.fn(() => samplesPerPixel),
    getWidth: vi.fn(() => width)
  };
}

function createTiffStub({
  bigTiff = false,
  firstIFDOffset = 8,
  images,
  littleEndian = true,
  nextIFDByteOffsets
}: {
  bigTiff?: boolean;
  firstIFDOffset?: number;
  images: ImageStub[];
  littleEndian?: boolean;
  nextIFDByteOffsets?: number[];
}): Pick<
  GeoTIFF,
  'bigTiff' | 'firstIFDOffset' | 'getImage' | 'getImageCount' | 'littleEndian' | 'requestIFD'
> {
  return {
    bigTiff,
    firstIFDOffset,
    getImage: vi.fn(async (index = 0) => images[index]),
    getImageCount: vi.fn(async () => images.length),
    littleEndian,
    requestIFD: vi.fn(async (index: number) => ({
      nextIFDByteOffset: nextIFDByteOffsets?.[index] ?? 0
    }))
  };
}

beforeEach(() => {
  mocks.addDecoder.mockReset();
  mocks.fromBlob.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildTiffSampleParams', () => {
  it('creates a single-channel image-only sample when TIFF metadata is minimal', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'brain-scan.tif', { type: 'image/tiff' });
    const objectUrl = 'blob:brain-scan';
    vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce(objectUrl);

    const image = createImageStub();
    mocks.fromBlob.mockResolvedValue(createTiffStub({ images: [image] }));

    const params = await buildTiffSampleParams(file);

    expect(params).toMatchObject({
      name: 'brain-scan',
      imgParams: {
        urls: [{ url: objectUrl, type: 'network' }],
        channels: ['C1'],
        hasPhysicalScale: false,
        renderMode: 'local-tiff',
        size: { width: 10, height: 10 },
        mPerPx: 1,
        dtype: 'uint8',
        maxVal: 255
      }
    });
  });

  it('detects RGB TIFFs and reuses meter-based scale plus GDAL statistics', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'rgb-scan.tiff', { type: 'image/tiff' });
    vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:rgb-scan');

    const image = createImageStub({
      bitsPerSample: 16,
      gdalMetadata: {
        0: { STATISTICS_MAXIMUM: '300' },
        1: { STATISTICS_MAXIMUM: '1200' },
        2: { STATISTICS_MAXIMUM: '900' },
        dataset: null
      },
      geoKeys: { ProjectedCSTypeGeoKey: 32648 },
      photometricInterpretation: 2,
      resolution: [0.25, -0.25, 0],
      samplesPerPixel: 3
    });
    mocks.fromBlob.mockResolvedValue(createTiffStub({ images: [image] }));

    const imgParams = await buildTiffImageParams(file);

    expect(imgParams).toMatchObject({
      channels: 'rgb',
      dtype: 'uint16',
      hasPhysicalScale: true,
      renderMode: 'local-tiff',
      size: { width: 10, height: 10 },
      mPerPx: 0.25,
      maxVal: 1200
    });
  });

  it('rejects unsupported TIFF dtypes', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'float-scan.tif', { type: 'image/tiff' });

    const image = createImageStub({
      bitsPerSample: 32,
      sampleFormat: 3
    });
    mocks.fromBlob.mockResolvedValue(createTiffStub({ images: [image] }));

    await expect(buildTiffImageParams(file)).rejects.toThrow(
      'Unsupported TIFF dtype: only uint8 and uint16 are supported.'
    );
  });

  it('splits multi-page same-resolution grayscale TIFFs into one URL per page', async () => {
    const fileBytes = new Uint8Array(64);
    const view = new DataView(fileBytes.buffer);
    view.setUint16(8, 0, true);
    view.setUint16(16, 0, true);
    const file = new File([fileBytes], 'stitched.tif', { type: 'image/tiff' });
    const arrayBufferSpy = vi.spyOn(file, 'arrayBuffer');
    vi.spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:page-1')
      .mockReturnValueOnce('blob:page-2');

    const firstImage = createImageStub({
      bitsPerSample: 16,
      gdalMetadata: { dataset: null, 0: { STATISTICS_MAXIMUM: '1200' } },
      height: 16,
      width: 12
    });
    const secondImage = createImageStub({
      bitsPerSample: 16,
      gdalMetadata: { dataset: null, 0: { STATISTICS_MAXIMUM: '900' } },
      height: 16,
      width: 12
    });

    mocks.fromBlob.mockResolvedValue(
      createTiffStub({
        images: [firstImage, secondImage],
        nextIFDByteOffsets: [16, 0]
      })
    );

    const imgParams = await buildTiffImageParams(file);

    expect(imgParams).toMatchObject({
      urls: [
        { url: 'blob:page-1', type: 'network' },
        { url: 'blob:page-2', type: 'network' }
      ],
      channels: ['C1', 'C2'],
      hasPhysicalScale: false,
      renderMode: 'local-tiff',
      size: { width: 12, height: 16 },
      mPerPx: 1,
      dtype: 'uint16',
      maxVal: 65535
    });
    expect(arrayBufferSpy).not.toHaveBeenCalled();
  });

  it('does not build full-file-sized blobs when splitting multi-page TIFFs', async () => {
    const fileBytes = new Uint8Array(4096);
    const view = new DataView(fileBytes.buffer);
    view.setUint16(8, 0, true);
    view.setUint16(16, 0, true);
    const file = new File([fileBytes], 'stitched.tif', { type: 'image/tiff' });

    const createObjectURLSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:page-1')
      .mockReturnValueOnce('blob:page-2');

    const firstImage = createImageStub({ height: 16, width: 12 });
    const secondImage = createImageStub({ height: 16, width: 12 });
    mocks.fromBlob.mockResolvedValue(
      createTiffStub({
        images: [firstImage, secondImage],
        nextIFDByteOffsets: [16, 0]
      })
    );

    await buildTiffImageParams(file);

    const firstBlob = createObjectURLSpy.mock.calls[0]?.[0] as Blob;
    const secondBlob = createObjectURLSpy.mock.calls[1]?.[0] as Blob;
    expect(firstBlob.size).toBeLessThan(file.size);
    expect(secondBlob.size).toBeLessThan(file.size);
  });
});
