import { fromBlob, type GeoTIFF, type GeoTIFFImage } from 'geotiff';

import type { SampleParams } from '$lib/data/objects/sample';
import type { ImageParams } from './objects/image';
import { registerTiffCodecs } from './tiffCodecs';

registerTiffCodecs();

const METER_LINEAR_UNIT_CODE = 9001;
const RGB_PHOTOMETRIC_INTERPRETATION = 2;
const SAMPLE_FORMAT_UINT = 1;

export const MAX_BROWSER_TIFF_BYTES = 1024 ** 3;

function getFileStem(name: string) {
  return name.replace(/\.[^.]+$/, '') || name;
}

function parseNumericMetadata(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function getFallbackMax(dtype: ImageParams['dtype']) {
  return dtype === 'uint16' ? 65535 : 255;
}

function getPhotometricInterpretation(image: GeoTIFFImage) {
  return image.getFileDirectory().getValue('PhotometricInterpretation');
}

function inferChannels(image: GeoTIFFImage): ImageParams['channels'] {
  const sampleCount = image.getSamplesPerPixel();
  const photometricInterpretation = getPhotometricInterpretation(image);

  if (sampleCount === 3 && photometricInterpretation === RGB_PHOTOMETRIC_INTERPRETATION) {
    return 'rgb';
  }

  return Array.from({ length: sampleCount }, (_, index) => `C${index + 1}`);
}

function inferChannelNames(count: number): ImageParams['channels'] {
  return Array.from({ length: count }, (_, index) => `C${index + 1}`);
}

function inferDtype(image: GeoTIFFImage): ImageParams['dtype'] {
  const sampleCount = image.getSamplesPerPixel();
  const firstBits = image.getBitsPerSample(0);
  const firstFormat = image.getSampleFormat(0);

  for (let sampleIndex = 1; sampleIndex < sampleCount; sampleIndex += 1) {
    if (
      image.getBitsPerSample(sampleIndex) !== firstBits ||
      image.getSampleFormat(sampleIndex) !== firstFormat
    ) {
      throw new Error('Unsupported TIFF dtype: mixed sample formats are not supported.');
    }
  }

  if (firstFormat !== SAMPLE_FORMAT_UINT) {
    throw new Error('Unsupported TIFF dtype: only uint8 and uint16 are supported.');
  }

  if (firstBits === 8) return 'uint8';
  if (firstBits === 16) return 'uint16';

  throw new Error('Unsupported TIFF dtype: only uint8 and uint16 are supported.');
}

function inferMetersPerPixel(image: GeoTIFFImage) {
  const geoKeys = image.getGeoKeys();
  if (!geoKeys) {
    return 1;
  }

  const unitCode = geoKeys.ProjLinearUnitsGeoKey;
  const projected = geoKeys.ProjectedCSTypeGeoKey != null;

  if (unitCode != null && unitCode !== METER_LINEAR_UNIT_CODE) {
    return 1;
  }

  if (!projected && unitCode == null) {
    return 1;
  }

  try {
    const [resolutionX] = image.getResolution();
    return Number.isFinite(resolutionX) && resolutionX > 0 ? resolutionX : 1;
  } catch {
    return 1;
  }
}

async function inferMaxVal(image: GeoTIFFImage, dtype: ImageParams['dtype']) {
  const sampleCount = image.getSamplesPerPixel();
  const metadata = await Promise.all([
    image.getGDALMetadata(null),
    ...Array.from({ length: sampleCount }, (_, index) => image.getGDALMetadata(index))
  ]);

  const stats = metadata
    .map((entry) => parseNumericMetadata(entry?.STATISTICS_MAXIMUM))
    .filter((value): value is number => value != null);

  return stats.length ? Math.max(...stats) : getFallbackMax(dtype);
}

type TiffPage = {
  ifdOffset: number;
  image: GeoTIFFImage;
};

async function getTiffPages(tiff: GeoTIFF) {
  const count = await tiff.getImageCount();
  const pages: TiffPage[] = [];
  let ifdOffset = tiff.firstIFDOffset;

  for (let pageIndex = 0; pageIndex < count; pageIndex += 1) {
    const [image, ifd] = await Promise.all([tiff.getImage(pageIndex), tiff.requestIFD(pageIndex)]);
    pages.push({ image, ifdOffset });
    ifdOffset = ifd.nextIFDByteOffset;
  }

  return pages;
}

function isChannelPageLayout(pages: TiffPage[]) {
  if (pages.length <= 1) {
    return false;
  }

  const [firstPage] = pages;
  const width = firstPage.image.getWidth();
  const height = firstPage.image.getHeight();
  const firstBits = firstPage.image.getBitsPerSample(0);
  const firstFormat = firstPage.image.getSampleFormat(0);

  return pages.every(({ image }) => {
    return (
      image.getWidth() === width &&
      image.getHeight() === height &&
      image.getSamplesPerPixel() === 1 &&
      image.getBitsPerSample(0) === firstBits &&
      image.getSampleFormat(0) === firstFormat
    );
  });
}

function getEntryCount(view: DataView, ifdOffset: number, littleEndian: boolean, bigTiff: boolean) {
  if (bigTiff) {
    return Number(view.getBigUint64(ifdOffset, littleEndian));
  }

  return view.getUint16(ifdOffset, littleEndian);
}

function setOffsetValue(
  view: DataView,
  byteOffset: number,
  value: number,
  littleEndian: boolean,
  bigTiff: boolean
) {
  if (bigTiff) {
    view.setBigUint64(byteOffset, BigInt(value), littleEndian);
    return;
  }

  view.setUint32(byteOffset, value, littleEndian);
}

function getNextIfdPointerOffset(ifdOffset: number, entryCount: number, bigTiff: boolean) {
  if (bigTiff) {
    return ifdOffset + 8 + entryCount * 20;
  }

  return ifdOffset + 2 + entryCount * 12;
}

function createSingleIfdTiffBlob(
  bytes: ArrayBuffer,
  {
    ifdOffset,
    littleEndian,
    bigTiff
  }: { bigTiff: boolean; ifdOffset: number; littleEndian: boolean }
) {
  const copy = bytes.slice(0);
  const view = new DataView(copy);
  const firstIfdOffset = bigTiff ? 8 : 4;
  const entryCount = getEntryCount(view, ifdOffset, littleEndian, bigTiff);
  const nextIfdPointerOffset = getNextIfdPointerOffset(ifdOffset, entryCount, bigTiff);

  setOffsetValue(view, firstIfdOffset, ifdOffset, littleEndian, bigTiff);
  setOffsetValue(view, nextIfdPointerOffset, 0, littleEndian, bigTiff);

  return new Blob([copy], { type: 'image/tiff' });
}

export function isTiffFileName(name: string) {
  return /\.tiff?$/i.test(name);
}

export function getTiffImportLimitMessage(maxBytes = MAX_BROWSER_TIFF_BYTES) {
  const maxGigabytes = (maxBytes / 1024 ** 3).toLocaleString(undefined, {
    maximumFractionDigits: 0
  });
  return `Browser TIFF import is limited to ${maxGigabytes} GB. Please preprocess larger TIFF files before importing them into Samui.`;
}

export async function buildTiffImageParams(file: File): Promise<ImageParams> {
  const tiff = await fromBlob(file);
  const pages = await getTiffPages(tiff);
  const [firstPage] = pages;
  const dtype = inferDtype(firstPage.image);

  if (isChannelPageLayout(pages)) {
    const bytes = await file.arrayBuffer();
    const maxVals = await Promise.all(pages.map(({ image }) => inferMaxVal(image, dtype)));

    return {
      urls: pages.map(({ ifdOffset }) => ({
        url: URL.createObjectURL(
          createSingleIfdTiffBlob(bytes, {
            ifdOffset,
            littleEndian: tiff.littleEndian,
            bigTiff: tiff.bigTiff
          })
        ),
        type: 'network'
      })),
      channels: inferChannelNames(pages.length),
      renderMode: 'local-tiff',
      size: { width: firstPage.image.getWidth(), height: firstPage.image.getHeight() },
      mPerPx: inferMetersPerPixel(firstPage.image),
      dtype,
      maxVal: Math.max(...maxVals, getFallbackMax(dtype))
    };
  }

  return {
    urls: [{ url: URL.createObjectURL(file), type: 'network' }],
    channels: inferChannels(firstPage.image),
    renderMode: 'local-tiff',
    size: { width: firstPage.image.getWidth(), height: firstPage.image.getHeight() },
    mPerPx: inferMetersPerPixel(firstPage.image),
    dtype,
    maxVal: await inferMaxVal(firstPage.image, dtype)
  };
}

export async function buildTiffSampleParams(file: File): Promise<SampleParams> {
  return {
    name: getFileStem(file.name),
    imgParams: await buildTiffImageParams(file)
  };
}
