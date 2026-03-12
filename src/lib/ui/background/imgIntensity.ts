import { fromUrl } from 'geotiff';

import type { ImgData } from '$src/lib/data/objects/image';

const MAX_SUBSAMPLE_EDGE = 256;
const LOWER_PERCENTILE = 0.01;
const UPPER_PERCENTILE = 0.99;

function getSubsampleDimensions(width: number, height: number) {
  const scale = Math.min(1, MAX_SUBSAMPLE_EDGE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

function getPercentileIndex(sampleCount: number, percentile: number) {
  return Math.min(sampleCount - 1, Math.max(0, Math.floor((sampleCount - 1) * percentile)));
}

export function estimatePercentileWindow(
  values: ArrayLike<number>,
  maxVal: number
): [number, number] {
  if (values.length === 0) {
    return [0, maxVal];
  }

  const histogram = new Uint32Array(maxVal + 1);
  let sampleCount = 0;

  for (let index = 0; index < values.length; index += 1) {
    const value = Math.min(maxVal, Math.max(0, Math.round(values[index])));
    histogram[value] += 1;
    sampleCount += 1;
  }

  const lowerTarget = getPercentileIndex(sampleCount, LOWER_PERCENTILE);
  const upperTarget = getPercentileIndex(sampleCount, UPPER_PERCENTILE);

  let cumulative = 0;
  let lower = 0;
  let upper = maxVal;

  for (let value = 0; value < histogram.length; value += 1) {
    cumulative += histogram[value];
    if (cumulative > lowerTarget) {
      lower = value;
      break;
    }
  }

  cumulative = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    cumulative += histogram[value];
    if (cumulative > upperTarget) {
      upper = value;
      break;
    }
  }

  return [lower, upper];
}

function normalizeRasterResult(result: unknown) {
  if (Array.isArray(result)) {
    return result as Array<ArrayLike<number>>;
  }

  return [result as ArrayLike<number>];
}

async function readSubsampledRasters(url: string, samples?: number[]) {
  const tiff = await fromUrl(url);
  const image = await tiff.getImage();
  const { width, height } = getSubsampleDimensions(image.getWidth(), image.getHeight());

  return normalizeRasterResult(
    await image.readRasters({
      width,
      height,
      samples,
      interleave: false
    })
  );
}

export async function estimateCompositeMinMax(image: ImgData) {
  if (!Array.isArray(image.channels)) {
    throw new Error('Composite percentile estimation requires channel names.');
  }

  const ranges: Record<string, [number, number]> = {};

  if (image.urls.length === 1) {
    const samples = image.channels.map((_, index) => index);
    const rasters = await readSubsampledRasters(image.urls[0].url, samples);

    image.channels.forEach((channel, index) => {
      const values = rasters[index];
      if (!values) return;
      ranges[channel] = estimatePercentileWindow(values, image.maxVal);
    });

    return ranges;
  }

  const perChannelRanges = await Promise.all(
    image.channels.map(async (channel, index) => {
      const url = image.urls[index];
      if (!url) return null;
      const [values] = await readSubsampledRasters(url.url);
      if (!values) return null;
      return [channel, estimatePercentileWindow(values, image.maxVal)] as const;
    })
  );

  for (const entry of perChannelRanges) {
    if (!entry) continue;
    ranges[entry[0]] = entry[1];
  }

  return ranges;
}
