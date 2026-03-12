import { fromUrl, type GeoTIFFImage } from 'geotiff';
import type ViewOptions from 'ol/View.js';
import DataTileSource from 'ol/source/DataTile.js';
import TileGrid from 'ol/tilegrid/TileGrid.js';

import type { ImgData } from '$src/lib/data/objects/image';
import { registerTiffCodecs } from '$src/lib/data/tiffCodecs';

registerTiffCodecs();

const LOCAL_TIFF_TILE_SIZE = 256;
const LOCAL_TIFF_OVERVIEW_MAX_EDGES = [1024, 256] as const;

type TileWindow = {
  height: number;
  offsetX: number;
  offsetY: number;
  width: number;
};

type RasterWindow = [number, number, number, number];

type LocalTiffPage = {
  image: GeoTIFFImage;
  samples: number[];
};

type NativeLevel = {
  bandCount: number;
  height: number;
  kind: 'native';
  mPerPx: number;
  pages: LocalTiffPage[];
  width: number;
};

type OverviewLevel = {
  bandCount: number;
  bands: Float32Array[];
  height: number;
  kind: 'overview';
  mPerPx: number;
  width: number;
};

type OverviewLevelId = 'overview1' | 'overview2';

type OverviewLevelSpec = {
  height: number;
  id: OverviewLevelId;
  mPerPx: number;
  parent: 'native' | 'overview1';
  width: number;
};

type LocalTiffContext = {
  mode: ImgData['mode'];
  nativeLevel: NativeLevel;
  overviewLevels: Partial<Record<OverviewLevelId, OverviewLevel>>;
  overviewPromises: Partial<Record<OverviewLevelId, Promise<OverviewLevel | null>>>;
  overviewSpecs: OverviewLevelSpec[];
  tileGrid: TileGrid;
};

function requireLocalTiffSize(image: Pick<ImgData, 'renderMode' | 'size'>) {
  if (image.renderMode !== 'local-tiff' || !image.size) {
    throw new Error('Local TIFF rendering requires explicit TIFF dimensions.');
  }

  return image.size;
}

function getInitialResolutionFactor(width: number, height: number) {
  const fitFactor = Math.max(
    1,
    2 ** Math.ceil(Math.log2(Math.max(width, height) / LOCAL_TIFF_TILE_SIZE))
  );
  return fitFactor * 2;
}

function buildLocalTiffResolutions(
  nativeResolution: number,
  size: { height: number; width: number }
) {
  const resolutions: number[] = [];

  for (
    let factor = getInitialResolutionFactor(size.width, size.height);
    factor >= 0.25;
    factor /= 2
  ) {
    resolutions.push(nativeResolution * factor);
  }

  return resolutions;
}

function fitMaxEdge(width: number, height: number, maxEdge: number) {
  const edge = Math.max(width, height);
  if (edge <= maxEdge) {
    return null;
  }

  const scale = maxEdge / edge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

function buildOverviewSpecs(nativeLevel: NativeLevel) {
  const firstSize = fitMaxEdge(
    nativeLevel.width,
    nativeLevel.height,
    LOCAL_TIFF_OVERVIEW_MAX_EDGES[0]
  );
  if (!firstSize) {
    return [];
  }

  const overview1 = {
    id: 'overview1' as const,
    parent: 'native' as const,
    width: firstSize.width,
    height: firstSize.height,
    mPerPx: nativeLevel.mPerPx * (nativeLevel.width / firstSize.width)
  };

  const secondSize = fitMaxEdge(
    overview1.width,
    overview1.height,
    LOCAL_TIFF_OVERVIEW_MAX_EDGES[1]
  );
  if (!secondSize) {
    return [overview1];
  }

  return [
    overview1,
    {
      id: 'overview2' as const,
      parent: 'overview1' as const,
      width: secondSize.width,
      height: secondSize.height,
      mPerPx: overview1.mPerPx * (overview1.width / secondSize.width)
    }
  ];
}

function intersectExtent(
  [minX, minY, maxX, maxY]: [number, number, number, number],
  [otherMinX, otherMinY, otherMaxX, otherMaxY]: [number, number, number, number]
) {
  const intersection: [number, number, number, number] = [
    Math.max(minX, otherMinX),
    Math.max(minY, otherMinY),
    Math.min(maxX, otherMaxX),
    Math.min(maxY, otherMaxY)
  ];

  return intersection[0] < intersection[2] && intersection[1] < intersection[3]
    ? intersection
    : undefined;
}

function getTileWindow(
  tileExtent: [number, number, number, number],
  validExtent: [number, number, number, number],
  resolution: number
): TileWindow {
  const offsetX = Math.max(0, Math.floor((validExtent[0] - tileExtent[0]) / resolution));
  const offsetY = Math.max(0, Math.floor((tileExtent[3] - validExtent[3]) / resolution));
  const width = Math.max(
    1,
    Math.min(
      LOCAL_TIFF_TILE_SIZE - offsetX,
      Math.ceil((validExtent[2] - validExtent[0]) / resolution)
    )
  );
  const height = Math.max(
    1,
    Math.min(
      LOCAL_TIFF_TILE_SIZE - offsetY,
      Math.ceil((validExtent[3] - validExtent[1]) / resolution)
    )
  );

  return { offsetX, offsetY, width, height };
}

function getRasterWindow(
  validExtent: [number, number, number, number],
  level: Pick<NativeLevel | OverviewLevel, 'height' | 'mPerPx' | 'width'>
) {
  return [
    Math.max(0, Math.floor(validExtent[0] / level.mPerPx)),
    Math.max(0, Math.floor(-validExtent[3] / level.mPerPx)),
    Math.min(level.width, Math.ceil(validExtent[2] / level.mPerPx)),
    Math.min(level.height, Math.ceil(-validExtent[1] / level.mPerPx))
  ] as RasterWindow;
}

function createEmptyTile(mode: ImgData['mode'], bandCount: number) {
  const pixelCount = LOCAL_TIFF_TILE_SIZE * LOCAL_TIFF_TILE_SIZE * bandCount;
  return mode === 'rgb' ? new Uint8Array(pixelCount) : new Float32Array(pixelCount);
}

function normalizeRgbValue(value: number, maxVal: number) {
  const scale = maxVal > 0 ? 255 / maxVal : 1;
  return Math.max(0, Math.min(255, Math.round(value * scale)));
}

function mergeTileBands(
  mode: ImgData['mode'],
  bandCount: number,
  tileWindow: TileWindow,
  channelData: ArrayLike<number>[],
  maxVal: number
) {
  const tile = createEmptyTile(mode, bandCount);
  const rowStride = LOCAL_TIFF_TILE_SIZE * bandCount;

  for (let rowIndex = 0; rowIndex < tileWindow.height; rowIndex += 1) {
    const tileRowOffset =
      (tileWindow.offsetY + rowIndex) * rowStride + tileWindow.offsetX * bandCount;
    const sourceRowOffset = rowIndex * tileWindow.width;

    for (let colIndex = 0; colIndex < tileWindow.width; colIndex += 1) {
      const sourceIndex = sourceRowOffset + colIndex;
      const tileIndex = tileRowOffset + colIndex * bandCount;

      for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
        const value = channelData[bandIndex]?.[sourceIndex] ?? 0;
        tile[tileIndex + bandIndex] = mode === 'rgb' ? normalizeRgbValue(value, maxVal) : value;
      }
    }
  }

  return tile;
}

function normalizeRasterResult(result: unknown) {
  if (Array.isArray(result)) {
    return result as Array<ArrayLike<number>>;
  }

  return [result as ArrayLike<number>];
}

async function readNativeBands(
  level: NativeLevel,
  rasterWindow: RasterWindow,
  width: number,
  height: number,
  signal?: AbortSignal
) {
  const readOptions = {
    width,
    height,
    window: rasterWindow,
    interleave: false as const,
    resampleMethod: 'bilinear' as const,
    signal
  };

  if (level.pages.length === 1 && level.pages[0]?.samples.length > 1) {
    return normalizeRasterResult(
      await level.pages[0].image.readRasters({
        ...readOptions,
        samples: level.pages[0].samples
      })
    );
  }

  return Promise.all(
    level.pages.map(async ({ image, samples }) => {
      const raster = await image.readRasters({ ...readOptions, samples });
      return normalizeRasterResult(raster)[0] ?? new Float32Array(width * height);
    })
  );
}

function readOverviewBands(
  level: OverviewLevel,
  rasterWindow: RasterWindow,
  width: number,
  height: number
) {
  return level.bands.map((band) =>
    resampleOverviewBand(band, level.width, level.height, rasterWindow, width, height)
  );
}

function resampleOverviewBand(
  band: ArrayLike<number>,
  sourceWidth: number,
  sourceHeight: number,
  [minX, minY, maxX, maxY]: RasterWindow,
  width: number,
  height: number
) {
  const windowWidth = Math.max(1, maxX - minX);
  const windowHeight = Math.max(1, maxY - minY);
  const values = new Float32Array(width * height);

  for (let targetY = 0; targetY < height; targetY += 1) {
    const sourceY = Math.min(
      sourceHeight - 1,
      minY + Math.floor(((targetY + 0.5) * windowHeight) / height)
    );
    const rowOffset = targetY * width;

    for (let targetX = 0; targetX < width; targetX += 1) {
      const sourceX = Math.min(
        sourceWidth - 1,
        minX + Math.floor(((targetX + 0.5) * windowWidth) / width)
      );
      values[rowOffset + targetX] = band[sourceY * sourceWidth + sourceX] ?? 0;
    }
  }

  return values;
}

function toFloatBands(rasters: ArrayLike<number>[]) {
  return rasters.map((raster) => Float32Array.from(raster));
}

async function buildOverviewFromNative(level: NativeLevel, spec: OverviewLevelSpec) {
  const bands = toFloatBands(
    await readNativeBands(level, [0, 0, level.width, level.height], spec.width, spec.height)
  );

  return {
    kind: 'overview' as const,
    bandCount: level.bandCount,
    width: spec.width,
    height: spec.height,
    mPerPx: spec.mPerPx,
    bands
  };
}

function downsampleBand(
  band: ArrayLike<number>,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
) {
  const values = new Float32Array(targetWidth * targetHeight);

  for (let targetY = 0; targetY < targetHeight; targetY += 1) {
    const sourceStartY = Math.floor((targetY * sourceHeight) / targetHeight);
    const sourceEndY = Math.max(
      sourceStartY + 1,
      Math.floor(((targetY + 1) * sourceHeight) / targetHeight)
    );

    for (let targetX = 0; targetX < targetWidth; targetX += 1) {
      const sourceStartX = Math.floor((targetX * sourceWidth) / targetWidth);
      const sourceEndX = Math.max(
        sourceStartX + 1,
        Math.floor(((targetX + 1) * sourceWidth) / targetWidth)
      );
      let total = 0;
      let sampleCount = 0;

      for (let sourceY = sourceStartY; sourceY < sourceEndY; sourceY += 1) {
        const rowOffset = sourceY * sourceWidth;
        for (let sourceX = sourceStartX; sourceX < sourceEndX; sourceX += 1) {
          total += band[rowOffset + sourceX] ?? 0;
          sampleCount += 1;
        }
      }

      values[targetY * targetWidth + targetX] = sampleCount > 0 ? total / sampleCount : 0;
    }
  }

  return values;
}

function buildOverviewFromOverview(level: OverviewLevel, spec: OverviewLevelSpec) {
  return {
    kind: 'overview' as const,
    bandCount: level.bandCount,
    width: spec.width,
    height: spec.height,
    mPerPx: spec.mPerPx,
    bands: level.bands.map((band) =>
      downsampleBand(band, level.width, level.height, spec.width, spec.height)
    )
  };
}

function selectLevelSpec(context: LocalTiffContext, resolution: number) {
  const candidateSpecs = [
    { id: 'native' as const, mPerPx: context.nativeLevel.mPerPx },
    ...context.overviewSpecs.map((spec) => ({ id: spec.id, mPerPx: spec.mPerPx }))
  ];

  const usableLevels = candidateSpecs
    .filter((spec) => spec.mPerPx <= resolution)
    .sort((left, right) => right.mPerPx - left.mPerPx);
  if (usableLevels[0]) {
    return usableLevels[0];
  }

  return candidateSpecs.sort((left, right) => left.mPerPx - right.mPerPx)[0]!;
}

async function getOverviewLevel(context: LocalTiffContext, id: OverviewLevelId) {
  const cached = context.overviewLevels[id];
  if (cached) {
    return cached;
  }

  const pending = context.overviewPromises[id];
  if (pending) {
    return pending;
  }

  const spec = context.overviewSpecs.find((entry) => entry.id === id);
  if (!spec) {
    return null;
  }

  const promise = (async () => {
    const parent =
      spec.parent === 'native' ? context.nativeLevel : await getOverviewLevel(context, 'overview1');
    if (!parent) {
      return null;
    }

    const level =
      parent.kind === 'native'
        ? await buildOverviewFromNative(parent, spec)
        : buildOverviewFromOverview(parent, spec);
    context.overviewLevels[id] = level;
    return level;
  })().catch((error) => {
    delete context.overviewPromises[id];
    throw error;
  });

  context.overviewPromises[id] = promise;
  return promise;
}

async function buildLocalTiffContext(image: ImgData): Promise<LocalTiffContext> {
  const size = requireLocalTiffSize(image);
  const isRgb = image.mode === 'rgb';
  const compositeSamples =
    Array.isArray(image.channels) && image.urls.length === 1
      ? image.channels.map((_, index) => index)
      : [0];
  const pages = await Promise.all(
    image.urls.map(async ({ url }) => {
      const tiff = await fromUrl(url);
      const tiffImage = await tiff.getImage();

      return {
        image: tiffImage,
        samples: isRgb ? [0, 1, 2] : compositeSamples
      };
    })
  );

  const nativeLevel = {
    kind: 'native' as const,
    bandCount: image.mode === 'rgb' ? 3 : image.channels.length,
    width: size.width,
    height: size.height,
    mPerPx: image.mPerPx,
    pages
  };
  const resolutions = buildLocalTiffResolutions(image.mPerPx, size);
  const extent = [0, -size.height * image.mPerPx, size.width * image.mPerPx, 0] as const;

  return {
    mode: image.mode,
    nativeLevel,
    overviewLevels: {},
    overviewPromises: {},
    overviewSpecs: buildOverviewSpecs(nativeLevel),
    tileGrid: new TileGrid({
      extent: [...extent],
      resolutions,
      tileSize: LOCAL_TIFF_TILE_SIZE
    })
  };
}

/**
 * Imported TIFFs are pixel-space rasters, so their initial view should come from
 * explicit width/height metadata instead of `GeoTIFFSource.getView()`.
 */
export function buildLocalTiffViewOptions(image: Pick<ImgData, 'mPerPx' | 'renderMode' | 'size'>) {
  const size = requireLocalTiffSize(image);
  const extent = [0, -size.height * image.mPerPx, size.width * image.mPerPx, 0] as [
    number,
    number,
    number,
    number
  ];

  return {
    center: [extent[2] / 2, extent[1] / 2],
    constrainOnlyCenter: true,
    enableRotation: false,
    extent,
    resolutions: buildLocalTiffResolutions(image.mPerPx, size),
    showFullExtent: true
  } satisfies ViewOptions;
}

export function isLocalTiffImage(image: Pick<ImgData, 'renderMode' | 'size'>) {
  return image.renderMode === 'local-tiff' && image.size != undefined;
}

export async function createLocalTiffSource(image: ImgData) {
  if (!Array.isArray(image.channels)) {
    if (image.channels !== 'rgb') {
      throw new Error('Unsupported image mode for local TIFF rendering.');
    }
  }

  const context = await buildLocalTiffContext(image);
  const extent = context.tileGrid.getExtent() as [number, number, number, number];

  return new DataTileSource({
    bandCount: context.nativeLevel.bandCount,
    interpolate: false,
    key: image.urls.map(({ url }) => url).join('|'),
    loader: async (z, x, y, { signal }) => {
      const tileExtent = context.tileGrid.getTileCoordExtent([z, x, y]) as [
        number,
        number,
        number,
        number
      ];
      const validExtent = intersectExtent(tileExtent, extent);
      if (!validExtent) {
        return createEmptyTile(context.mode, context.nativeLevel.bandCount);
      }

      const requestedResolution = context.tileGrid.getResolution(z);
      const levelSpec = selectLevelSpec(context, requestedResolution);
      const level =
        levelSpec.id === 'native'
          ? context.nativeLevel
          : ((await getOverviewLevel(context, levelSpec.id)) ?? context.nativeLevel);

      const tileWindow = getTileWindow(tileExtent, validExtent, requestedResolution);
      const rasterWindow = getRasterWindow(validExtent, level);
      const channelData =
        level.kind === 'native'
          ? await readNativeBands(level, rasterWindow, tileWindow.width, tileWindow.height, signal)
          : readOverviewBands(level, rasterWindow, tileWindow.width, tileWindow.height);

      return mergeTileBands(
        context.mode,
        context.nativeLevel.bandCount,
        tileWindow,
        channelData,
        image.maxVal
      );
    },
    tileGrid: context.tileGrid,
    transition: 0
  });
}
