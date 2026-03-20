import { beforeEach, describe, expect, it, vi } from 'vitest';

const addDecoder = vi.fn();
const decode = vi.fn();

class MockBaseDecoder {
  parameters: {
    bitsPerSample: number | number[];
    planarConfiguration: number;
    predictor: number;
    tileHeight: number;
    tileWidth: number;
  };

  constructor(parameters: MockBaseDecoder['parameters']) {
    this.parameters = parameters;
  }

  async decode(buffer: ArrayBufferLike) {
    return this.decodeBlock(buffer);
  }

  async decodeBlock(_buffer: ArrayBufferLike) {
    throw new Error('decodeBlock not implemented');
  }
}

vi.mock('geotiff', () => ({
  addDecoder,
  BaseDecoder: MockBaseDecoder
}));

vi.mock('jpegxr', () => ({
  default: vi.fn(async () => ({ decode }))
}));

describe('registerTiffCodecs', () => {
  beforeEach(() => {
    addDecoder.mockReset();
    decode.mockReset();
    vi.resetModules();
  });

  it('registers JPEG XR NDPI decoding on the main thread', async () => {
    const { JPEGXR_NDPI_COMPRESSION, registerTiffCodecs } = await import('./tiffCodecs');

    registerTiffCodecs();

    expect(addDecoder).toHaveBeenCalledWith(
      JPEGXR_NDPI_COMPRESSION,
      expect.any(Function),
      undefined,
      false
    );
  });

  it('reorders decoded BGR pixels into RGB output', async () => {
    decode.mockReturnValue({
      width: 2,
      height: 1,
      pixelInfo: {
        bgr: true,
        bitsPerPixel: 24,
        channels: 3
      },
      bytes: new Uint8Array([30, 20, 10, 60, 50, 40])
    });

    const { registerTiffCodecs } = await import('./tiffCodecs');
    registerTiffCodecs();

    const importDecoder = addDecoder.mock.calls[0][1] as () => Promise<typeof MockBaseDecoder>;
    const Decoder = await importDecoder();
    const decoder = new Decoder({
      bitsPerSample: [8, 8, 8],
      planarConfiguration: 1,
      predictor: 1,
      tileHeight: 1,
      tileWidth: 2
    });

    const output = await decoder.decode(new Uint8Array([1, 2, 3]).buffer);

    expect(Array.from(new Uint8Array(output))).toEqual([10, 20, 30, 40, 50, 60]);
  });

  it('accepts one decoded channel per block for planar-separated TIFFs', async () => {
    decode.mockReturnValue({
      width: 2,
      height: 1,
      pixelInfo: {
        bgr: false,
        bitsPerPixel: 16,
        channels: 1
      },
      bytes: new Uint8Array([1, 0, 2, 0])
    });

    const { registerTiffCodecs } = await import('./tiffCodecs');
    registerTiffCodecs();

    const importDecoder = addDecoder.mock.calls[0][1] as () => Promise<typeof MockBaseDecoder>;
    const Decoder = await importDecoder();
    const decoder = new Decoder({
      bitsPerSample: [16, 16],
      planarConfiguration: 2,
      predictor: 1,
      tileHeight: 1,
      tileWidth: 2
    });

    const output = await decoder.decode(new Uint8Array([1, 2, 3]).buffer);

    expect(Array.from(new Uint8Array(output))).toEqual([1, 0, 2, 0]);
  });

  it('fails when the decoder returns a different channel count', async () => {
    decode.mockReturnValue({
      width: 1,
      height: 1,
      pixelInfo: {
        bgr: false,
        bitsPerPixel: 8,
        channels: 1
      },
      bytes: new Uint8Array([255])
    });

    const { registerTiffCodecs } = await import('./tiffCodecs');
    registerTiffCodecs();

    const importDecoder = addDecoder.mock.calls[0][1] as () => Promise<typeof MockBaseDecoder>;
    const Decoder = await importDecoder();
    const decoder = new Decoder({
      bitsPerSample: [8, 8, 8],
      planarConfiguration: 1,
      predictor: 1,
      tileHeight: 1,
      tileWidth: 1
    });

    await expect(decoder.decode(new Uint8Array([1]).buffer)).rejects.toThrow(
      'JPEG XR TIFF decoder sample mismatch: expected 3, got 1.'
    );
  });
});
