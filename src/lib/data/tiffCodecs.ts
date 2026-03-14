import { addDecoder, BaseDecoder } from 'geotiff';

type JpegXrPixelInfo = {
  bgr: boolean;
  bitsPerPixel: number;
  channels: number;
};

type JpegXrDecodedImage = {
  bytes: Uint8Array;
  height: number;
  pixelInfo: JpegXrPixelInfo;
  width: number;
};

type JpegXrCodec = {
  decode(bytes: Uint8Array): JpegXrDecodedImage;
};

export const JPEGXR_NDPI_COMPRESSION = 22610;

let jpegXrCodecPromise: Promise<JpegXrCodec> | undefined;
let registered = false;

function getExpectedSamplesPerBlock(
  bitsPerSample: number | number[] | ArrayLike<number>,
  planarConfiguration: number
) {
  if (planarConfiguration === 2) {
    return 1;
  }

  if (typeof bitsPerSample === 'number') {
    return 1;
  }

  return bitsPerSample.length;
}

function getExpectedBitsPerSample(bitsPerSample: number | number[] | ArrayLike<number>) {
  if (typeof bitsPerSample === 'number') {
    return bitsPerSample;
  }

  const firstBits = bitsPerSample[0];
  for (let sampleIndex = 1; sampleIndex < bitsPerSample.length; sampleIndex += 1) {
    if (bitsPerSample[sampleIndex] !== firstBits) {
      throw new Error('JPEG XR TIFF decoding requires the same bit depth for every sample.');
    }
  }

  return firstBits;
}

async function getJpegXrCodec() {
  if (!jpegXrCodecPromise) {
    jpegXrCodecPromise = import('jpegxr').then(({ default: jpegxr }) => jpegxr());
  }

  return jpegXrCodecPromise;
}

function reorderBgrToRgb(bytes: Uint8Array, sampleBytes: number, channelCount: number) {
  const reordered = new Uint8Array(bytes.length);
  const pixelStride = sampleBytes * channelCount;

  for (let offset = 0; offset < bytes.length; offset += pixelStride) {
    reordered.set(bytes.subarray(offset + sampleBytes * 2, offset + sampleBytes * 3), offset);
    reordered.set(
      bytes.subarray(offset + sampleBytes, offset + sampleBytes * 2),
      offset + sampleBytes
    );
    reordered.set(bytes.subarray(offset, offset + sampleBytes), offset + sampleBytes * 2);

    for (let channelIndex = 3; channelIndex < channelCount; channelIndex += 1) {
      const channelOffset = offset + channelIndex * sampleBytes;
      reordered.set(bytes.subarray(channelOffset, channelOffset + sampleBytes), channelOffset);
    }
  }

  return reordered;
}

export class JpegXrNdpiDecoder extends BaseDecoder {
  async decodeBlock(buffer: ArrayBufferLike) {
    const codec = await getJpegXrCodec();
    const decoded = codec.decode(new Uint8Array(buffer));
    const expectedSamplesPerBlock = getExpectedSamplesPerBlock(
      this.parameters.bitsPerSample,
      this.parameters.planarConfiguration
    );
    const expectedBitsPerSample = getExpectedBitsPerSample(this.parameters.bitsPerSample);
    const expectedSampleBytes = expectedBitsPerSample / 8;

    if (!Number.isInteger(expectedSampleBytes)) {
      throw new Error('JPEG XR TIFF decoding only supports byte-aligned sample sizes.');
    }

    if (decoded.width !== this.parameters.tileWidth) {
      throw new Error(
        `JPEG XR TIFF decoder width mismatch: expected ${this.parameters.tileWidth}, got ${decoded.width}.`
      );
    }

    if (decoded.height > this.parameters.tileHeight) {
      throw new Error(
        `JPEG XR TIFF decoder height mismatch: expected at most ${this.parameters.tileHeight}, got ${decoded.height}.`
      );
    }

    if (decoded.pixelInfo.channels !== expectedSamplesPerBlock) {
      throw new Error(
        `JPEG XR TIFF decoder sample mismatch: expected ${expectedSamplesPerBlock}, got ${decoded.pixelInfo.channels}.`
      );
    }

    const expectedBytes =
      decoded.width * decoded.height * expectedSamplesPerBlock * expectedSampleBytes;
    if (decoded.bytes.byteLength !== expectedBytes) {
      throw new Error(
        `JPEG XR TIFF decoder output size mismatch: expected ${expectedBytes} bytes, got ${decoded.bytes.byteLength}.`
      );
    }

    if (decoded.pixelInfo.bitsPerPixel !== expectedSamplesPerBlock * expectedBitsPerSample) {
      throw new Error(
        `JPEG XR TIFF decoder bit depth mismatch: expected ${expectedSamplesPerBlock * expectedBitsPerSample}, got ${decoded.pixelInfo.bitsPerPixel}.`
      );
    }

    if (decoded.pixelInfo.bgr && expectedSamplesPerBlock >= 3) {
      return reorderBgrToRgb(decoded.bytes, expectedSampleBytes, expectedSamplesPerBlock).buffer;
    }

    return decoded.bytes.buffer.slice(
      decoded.bytes.byteOffset,
      decoded.bytes.byteOffset + decoded.bytes.byteLength
    );
  }
}

export function registerTiffCodecs() {
  if (registered) {
    return;
  }

  addDecoder(JPEGXR_NDPI_COMPRESSION, async () => JpegXrNdpiDecoder, undefined, false);
  registered = true;
}
