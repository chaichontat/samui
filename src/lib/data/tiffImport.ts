import { fromBlob, type GeoTIFF, type GeoTIFFImage } from 'geotiff';

import type { SampleParams } from '$lib/data/objects/sample';
import type { ImageParams } from './objects/image';
import { registerTiffCodecs } from './tiffCodecs';

registerTiffCodecs();

const METER_LINEAR_UNIT_CODE = 9001;
const RGB_PHOTOMETRIC_INTERPRETATION = 2;
const SAMPLE_FORMAT_UINT = 1;
const TIFF_RESOLUTION_UNIT_INCH = 2;
const TIFF_RESOLUTION_UNIT_CENTIMETER = 3;

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

function parseRationalMetadata(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    const numerator = parseNumericMetadata(value[0]);
    const denominator = parseNumericMetadata(value[1]);
    if (
      numerator != undefined &&
      denominator != undefined &&
      Number.isFinite(numerator) &&
      Number.isFinite(denominator) &&
      denominator > 0
    ) {
      return numerator / denominator;
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

async function loadIfdValue(image: GeoTIFFImage, tag: string) {
  const fileDirectory = image.getFileDirectory();

  try {
    return fileDirectory.getValue(tag);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('is deferred') &&
      'loadValue' in fileDirectory &&
      typeof fileDirectory.loadValue === 'function'
    ) {
      return fileDirectory.loadValue(tag);
    }

    throw error;
  }
}

async function inferScaleInfo(image: GeoTIFFImage) {
  const geoKeys = image.getGeoKeys();
  if (geoKeys) {
    const unitCode = geoKeys.ProjLinearUnitsGeoKey;
    const projected = geoKeys.ProjectedCSTypeGeoKey != null;

    if (unitCode != null && unitCode !== METER_LINEAR_UNIT_CODE) {
      return { hasPhysicalScale: false, mPerPx: 1 };
    }

    if (projected || unitCode != null) {
      try {
        const [resolutionX] = image.getResolution();
        if (Number.isFinite(resolutionX) && resolutionX > 0) {
          return { hasPhysicalScale: true, mPerPx: resolutionX };
        }
      } catch {
        return { hasPhysicalScale: false, mPerPx: 1 };
      }
    }
  }

  const [resolutionUnitValue, resolutionXValue] = await Promise.all([
    loadIfdValue(image, 'ResolutionUnit'),
    loadIfdValue(image, 'XResolution')
  ]);
  const resolutionUnit = parseNumericMetadata(resolutionUnitValue);
  const resolutionX = parseRationalMetadata(resolutionXValue);

  if (resolutionX != undefined && resolutionX > 0) {
    if (resolutionUnit === TIFF_RESOLUTION_UNIT_INCH) {
      return { hasPhysicalScale: true, mPerPx: 0.0254 / resolutionX };
    }

    if (resolutionUnit === TIFF_RESOLUTION_UNIT_CENTIMETER) {
      return { hasPhysicalScale: true, mPerPx: 0.01 / resolutionX };
    }
  }

  return { hasPhysicalScale: false, mPerPx: 1 };
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

  const dtypeMax = getFallbackMax(dtype);
  return stats.length ? Math.min(dtypeMax, Math.max(...stats)) : dtypeMax;
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

function validateTiffLayout(pages: TiffPage[]) {
  if (pages.length <= 1 || isChannelPageLayout(pages)) {
    return;
  }

  throw new Error(
    'Unsupported TIFF dimensions: only 2D images and 3D channel stacks are supported.'
  );
}

function getEntryCount(view: DataView, ifdOffset: number, littleEndian: boolean, bigTiff: boolean) {
  if (bigTiff) {
    return Number(view.getBigUint64(ifdOffset, littleEndian));
  }

  return view.getUint16(ifdOffset, littleEndian);
}

function encodeOffsetValue(value: number, littleEndian: boolean, bigTiff: boolean) {
  const bytes = new ArrayBuffer(bigTiff ? 8 : 4);
  const view = new DataView(bytes);

  if (bigTiff) {
    view.setBigUint64(0, BigInt(value), littleEndian);
  } else {
    view.setUint32(0, value, littleEndian);
  }

  return new Uint8Array(bytes);
}

function getNextIfdPointerOffset(ifdOffset: number, entryCount: number, bigTiff: boolean) {
  if (bigTiff) {
    return ifdOffset + 8 + entryCount * 20;
  }

  return ifdOffset + 2 + entryCount * 12;
}

const STRIP_OFFSETS_TAG = 273;
const STRIP_BYTE_COUNTS_TAG = 279;
const TILE_OFFSETS_TAG = 324;
const TILE_BYTE_COUNTS_TAG = 325;
const JPEG_INTERCHANGE_FORMAT_TAG = 513;
const JPEG_INTERCHANGE_FORMAT_LENGTH_TAG = 514;

function getTiffTypeByteLength(type: number) {
  // TIFF 6.0 field types (plus BigTIFF additions).
  switch (type) {
    case 1: // BYTE
    case 2: // ASCII
    case 6: // SBYTE
    case 7: // UNDEFINED
      return 1;
    case 3: // SHORT
    case 8: // SSHORT
      return 2;
    case 4: // LONG
    case 9: // SLONG
    case 11: // FLOAT
    case 13: // IFD
      return 4;
    case 5: // RATIONAL
    case 10: // SRATIONAL
    case 12: // DOUBLE
      return 8;
    case 16: // LONG8
    case 17: // SLONG8
    case 18: // IFD8
      return 8;
    default:
      throw new Error(`Unsupported TIFF field type: ${type}`);
  }
}

function readNumericTiffValues(
  view: DataView,
  type: number,
  count: number,
  littleEndian: boolean
): number[] {
  const values: number[] = [];
  const byteLength = getTiffTypeByteLength(type);

  for (let index = 0; index < count; index += 1) {
    const offset = index * byteLength;
    switch (type) {
      case 1: // BYTE
      case 7: // UNDEFINED
        values.push(view.getUint8(offset));
        break;
      case 3: // SHORT
        values.push(view.getUint16(offset, littleEndian));
        break;
      case 4: // LONG
      case 13: // IFD
        values.push(view.getUint32(offset, littleEndian));
        break;
      case 16: // LONG8
      case 18: {
        const raw = view.getBigUint64(offset, littleEndian);
        const numberValue = Number(raw);
        if (!Number.isSafeInteger(numberValue)) {
          throw new Error('Unsupported TIFF offset: value exceeds MAX_SAFE_INTEGER.');
        }
        values.push(numberValue);
        break;
      }
      default:
        throw new Error(`Unsupported TIFF numeric field type: ${type}`);
    }
  }

  return values;
}

type IfdEntry = {
  tag: number;
  type: number;
  count: number;
  isInline: boolean;
  valueBytes: Uint8Array;
  valueOrOffset: number;
};

async function readIfdEntries(
  file: Blob,
  {
    ifdOffset,
    littleEndian,
    bigTiff
  }: { bigTiff: boolean; ifdOffset: number; littleEndian: boolean }
): Promise<{ entries: IfdEntry[]; entryCount: number; nextIfdPointerOffset: number }> {
  const offsetByteLength = bigTiff ? 8 : 4;
  const entryCountByteLength = bigTiff ? 8 : 2;
  const entryByteLength = bigTiff ? 20 : 12;
  const valueByteLength = offsetByteLength;

  const entryCount = getEntryCount(
    new DataView(await file.slice(ifdOffset, ifdOffset + entryCountByteLength).arrayBuffer()),
    0,
    littleEndian,
    bigTiff
  );

  const nextIfdPointerOffset = getNextIfdPointerOffset(ifdOffset, entryCount, bigTiff);
  const entriesStart = ifdOffset + entryCountByteLength;
  const entriesByteLength = entryCount * entryByteLength;

  const entriesBuffer = await file
    .slice(entriesStart, entriesStart + entriesByteLength)
    .arrayBuffer();
  const view = new DataView(entriesBuffer);
  const entries: IfdEntry[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    const baseOffset = index * entryByteLength;
    const tag = view.getUint16(baseOffset, littleEndian);
    const type = view.getUint16(baseOffset + 2, littleEndian);
    const count = bigTiff
      ? Number(view.getBigUint64(baseOffset + 4, littleEndian))
      : view.getUint32(baseOffset + 4, littleEndian);

    const valueFieldOffset = baseOffset + (bigTiff ? 12 : 8);
    const valueBytes = new Uint8Array(entriesBuffer, valueFieldOffset, valueByteLength);
    const valueOrOffset = bigTiff
      ? Number(view.getBigUint64(valueFieldOffset, littleEndian))
      : view.getUint32(valueFieldOffset, littleEndian);

    const totalValueByteLength = count * getTiffTypeByteLength(type);
    const isInline = totalValueByteLength <= valueByteLength;

    entries.push({ tag, type, count, isInline, valueBytes, valueOrOffset });
  }

  return { entries, entryCount, nextIfdPointerOffset };
}

async function readIfdEntryNumberArray(
  file: Blob,
  entry: IfdEntry,
  { littleEndian, bigTiff }: { bigTiff: boolean; littleEndian: boolean }
) {
  const offsetByteLength = bigTiff ? 8 : 4;
  const totalByteLength = entry.count * getTiffTypeByteLength(entry.type);

  if (entry.isInline) {
    const bytes = entry.valueBytes.subarray(0, totalByteLength);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return readNumericTiffValues(view, entry.type, entry.count, littleEndian);
  }

  const dataBuffer = await file
    .slice(entry.valueOrOffset, entry.valueOrOffset + totalByteLength)
    .arrayBuffer();
  const view = new DataView(dataBuffer);
  return readNumericTiffValues(view, entry.type, entry.count, littleEndian);
}

async function findIfdReferencedByteEnd(
  file: Blob,
  {
    ifdOffset,
    littleEndian,
    bigTiff
  }: { bigTiff: boolean; ifdOffset: number; littleEndian: boolean }
) {
  const offsetByteLength = bigTiff ? 8 : 4;
  const entryCountByteLength = bigTiff ? 8 : 2;
  const valueByteLength = offsetByteLength;

  const { entries, entryCount, nextIfdPointerOffset } = await readIfdEntries(file, {
    ifdOffset,
    littleEndian,
    bigTiff
  });

  let maxEnd = nextIfdPointerOffset + offsetByteLength;

  for (const entry of entries) {
    const totalValueByteLength = entry.count * getTiffTypeByteLength(entry.type);
    if (totalValueByteLength > valueByteLength) {
      maxEnd = Math.max(maxEnd, entry.valueOrOffset + totalValueByteLength);
    }
  }

  const entryMap = new Map<number, IfdEntry>();
  for (const entry of entries) {
    entryMap.set(entry.tag, entry);
  }

  const getImageDataMaxEnd = async (offsetTag: number, byteCountsTag: number) => {
    const offsetsEntry = entryMap.get(offsetTag);
    const countsEntry = entryMap.get(byteCountsTag);
    if (!offsetsEntry || !countsEntry) return undefined;

    const [offsets, counts] = await Promise.all([
      readIfdEntryNumberArray(file, offsetsEntry, { littleEndian, bigTiff }),
      readIfdEntryNumberArray(file, countsEntry, { littleEndian, bigTiff })
    ]);

    const length = Math.min(offsets.length, counts.length);
    let end = 0;
    for (let index = 0; index < length; index += 1) {
      end = Math.max(end, offsets[index] + counts[index]);
    }
    return end || undefined;
  };

  try {
    const stripEnd = await getImageDataMaxEnd(STRIP_OFFSETS_TAG, STRIP_BYTE_COUNTS_TAG);
    if (stripEnd != null) maxEnd = Math.max(maxEnd, stripEnd);

    const tileEnd = await getImageDataMaxEnd(TILE_OFFSETS_TAG, TILE_BYTE_COUNTS_TAG);
    if (tileEnd != null) maxEnd = Math.max(maxEnd, tileEnd);

    const jpegOffsetEntry = entryMap.get(JPEG_INTERCHANGE_FORMAT_TAG);
    const jpegLengthEntry = entryMap.get(JPEG_INTERCHANGE_FORMAT_LENGTH_TAG);
    if (jpegOffsetEntry && jpegLengthEntry) {
      const [offsets, lengths] = await Promise.all([
        readIfdEntryNumberArray(file, jpegOffsetEntry, { littleEndian, bigTiff }),
        readIfdEntryNumberArray(file, jpegLengthEntry, { littleEndian, bigTiff })
      ]);
      if (offsets.length && lengths.length) {
        maxEnd = Math.max(maxEnd, offsets[0] + lengths[0]);
      }
    }
  } catch {
    return file.size;
  }

  const minimumEnd =
    ifdOffset + entryCountByteLength + entryCount * (bigTiff ? 20 : 12) + offsetByteLength;
  return Math.max(maxEnd, minimumEnd);
}

async function createSingleIfdTiffBlob(
  file: Blob,
  {
    ifdOffset,
    littleEndian,
    bigTiff
  }: { bigTiff: boolean; ifdOffset: number; littleEndian: boolean }
) {
  const firstIfdOffset = bigTiff ? 8 : 4;
  const offsetByteLength = bigTiff ? 8 : 4;
  const entryCountByteLength = bigTiff ? 8 : 2;
  const entryCount = getEntryCount(
    new DataView(await file.slice(ifdOffset, ifdOffset + entryCountByteLength).arrayBuffer()),
    0,
    littleEndian,
    bigTiff
  );
  const nextIfdPointerOffset = getNextIfdPointerOffset(ifdOffset, entryCount, bigTiff);
  const end = Math.min(
    file.size,
    await findIfdReferencedByteEnd(file, { ifdOffset, littleEndian, bigTiff })
  );

  return new Blob(
    [
      file.slice(0, firstIfdOffset),
      encodeOffsetValue(ifdOffset, littleEndian, bigTiff),
      file.slice(firstIfdOffset + offsetByteLength, nextIfdPointerOffset),
      encodeOffsetValue(0, littleEndian, bigTiff),
      file.slice(nextIfdPointerOffset + offsetByteLength, end)
    ],
    { type: 'image/tiff' }
  );
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
  validateTiffLayout(pages);
  const [firstPage] = pages;
  const dtype = inferDtype(firstPage.image);
  const scaleInfo = await inferScaleInfo(firstPage.image);

  if (isChannelPageLayout(pages)) {
    const maxVals = await Promise.all(pages.map(({ image }) => inferMaxVal(image, dtype)));
    const urls = await Promise.all(
      pages.map(async ({ ifdOffset }) => ({
        url: URL.createObjectURL(
          await createSingleIfdTiffBlob(file, {
            ifdOffset,
            littleEndian: tiff.littleEndian,
            bigTiff: tiff.bigTiff
          })
        ),
        type: 'network' as const
      }))
    );

    return {
      urls,
      channels: inferChannelNames(pages.length),
      ...scaleInfo,
      renderMode: 'local-tiff',
      size: { width: firstPage.image.getWidth(), height: firstPage.image.getHeight() },
      dtype,
      maxVal: Math.max(...maxVals)
    };
  }

  return {
    urls: [{ url: URL.createObjectURL(file), type: 'network' }],
    channels: inferChannels(firstPage.image),
    ...scaleInfo,
    renderMode: 'local-tiff',
    size: { width: firstPage.image.getWidth(), height: firstPage.image.getHeight() },
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
