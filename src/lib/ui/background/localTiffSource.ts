import { fromUrl, type GeoTIFFImage } from 'geotiff';
import type ViewOptions from 'ol/View.js';
import DataTileSource from 'ol/source/DataTile.js';
import TileGrid from 'ol/tilegrid/TileGrid.js';

import type { ImgData } from '$src/lib/data/objects/image';
import { registerTiffCodecs } from '$src/lib/data/tiffCodecs';

registerTiffCodecs();

const LOCAL_TIFF_TILE_SIZE = 256;

type TileWindow = {
  height: number;
  offsetX: number;
  offsetY: number;
  width: number;
};

type LocalTiffPage = {
  image: GeoTIFFImage;
  samples: number[];
};

type LocalTiffContext = {
  bandCount: number;
  mode: ImgData['mode'];
  pages: LocalTiffPage[];
  tileGrid: TileGrid;
};

function requireLocalTiffSize(image: Pick<ImgData, 'renderMode' | 'size'>) {
  if (image.renderMode !== 'local-tiff' || !image.size) {
    throw new Error('Local TIFF rendering requires explicit TIFF dimensions.');
  }

  return image.size;
}

function buildLocalTiffResolutions(nativeResolution: number) {
  return [
    nativeResolution * 128,
    nativeResolution * 2,
    nativeResolution,
    nativeResolution / 2,
    nativeResolution / 4
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
  image: Pick<ImgData, 'mPerPx' | 'renderMode' | 'size'>
) {
  const size = requireLocalTiffSize(image);

  return [
    Math.max(0, Math.floor(validExtent[0] / image.mPerPx)),
    Math.max(0, Math.floor(-validExtent[3] / image.mPerPx)),
    Math.min(size.width, Math.ceil(validExtent[2] / image.mPerPx)),
    Math.min(size.height, Math.ceil(-validExtent[1] / image.mPerPx))
  ] as [number, number, number, number];
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
        const value = channelData[bandIndex][sourceIndex];
        tile[tileIndex + bandIndex] = mode === 'rgb' ? normalizeRgbValue(value, maxVal) : value;
      }
    }
  }

  return tile;
}

async function readTileBands(
  { mode, pages }: Pick<LocalTiffContext, 'mode' | 'pages'>,
  rasterWindow: [number, number, number, number],
  tileWindow: Pick<TileWindow, 'height' | 'width'>,
  signal?: AbortSignal
) {
  const readOptions = {
    height: tileWindow.height,
    interleave: false,
    signal,
    width: tileWindow.width,
    window: rasterWindow
  };

  if (mode === 'rgb') {
    const raster = await pages[0].image.readRasters({
      ...readOptions,
      samples: pages[0].samples
    });
    return raster as ArrayLike<number>[];
  }

  const rasters = await Promise.all(
    pages.map(async ({ image, samples }) => {
      const raster = await image.readRasters({ ...readOptions, samples });
      return raster[0] as ArrayLike<number>;
    })
  );

  return rasters;
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
  const resolutions = buildLocalTiffResolutions(image.mPerPx);
  const extent = [0, -size.height * image.mPerPx, size.width * image.mPerPx, 0] as const;

  return {
    bandCount: image.mode === 'rgb' ? 3 : image.channels.length,
    mode: image.mode,
    pages,
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
    resolutions: buildLocalTiffResolutions(image.mPerPx),
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
    bandCount: context.bandCount,
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
        return createEmptyTile(context.mode, context.bandCount);
      }

      const tileWindow = getTileWindow(tileExtent, validExtent, context.tileGrid.getResolution(z));
      const rasterWindow = getRasterWindow(validExtent, image);
      const channelData = await readTileBands(context, rasterWindow, tileWindow, signal);

      return mergeTileBands(context.mode, context.bandCount, tileWindow, channelData, image.maxVal);
    },
    tileGrid: context.tileGrid,
    transition: 0
  });
}
