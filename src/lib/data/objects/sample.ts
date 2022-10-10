import { Deferrable } from '$src/lib/definitions';
import type { Url } from '$src/lib/io';
import { genLRU } from '$src/lib/lru';
import { CoordsData, type Coord, type CoordsParams } from './coords';
import { stats, type FeatureAndGroup, type FeatureData } from './feature';
import { ChunkedCSV, type ChunkedCSVParams } from './featureChunked';
import { PlainCSV, type PlainCSVParams } from './featurePlain';
import { ImgData, type ImageParams } from './image';

export type OverlayParams = {
  defaults?: FeatureAndGroup[];
  importantFeatures?: FeatureAndGroup[];
};

export type SampleParams = {
  name: string;
  imgParams?: ImageParams;
  coordParams?: CoordsParams[];
  featParams?: (PlainCSVParams | ChunkedCSVParams)[];
  overlayParams?: OverlayParams;
  notesMd?: Url;
  metadataMd?: Url;
};

export class Sample extends Deferrable {
  name: string;
  imgParams?: ImageParams;
  coordsParams?: CoordsParams[];
  featureParams?: (PlainCSVParams | ChunkedCSVParams)[];
  overlayParams?: OverlayParams;
  onlineCoords: Record<string, CoordsData> = {};
  notesMd?: Url;
  metadataMd?: Url;

  features: Record<string, FeatureData> = {};
  coords: Record<string, CoordsData> = {};

  image?: ImgData;
  handle?: FileSystemDirectoryHandle;

  constructor(
    { name, imgParams, coordParams, featParams, overlayParams, notesMd, metadataMd }: SampleParams,
    handle?: FileSystemDirectoryHandle,
    autoHydrate = false
  ) {
    super();
    this.name = name;
    this.imgParams = imgParams;
    if (this.imgParams) {
      this.image = new ImgData(this.imgParams, false);
    }
    // TODO: Rename on Python side.
    const featureParams = featParams;
    this.coordsParams = coordParams;
    this.featureParams = featureParams;
    this.overlayParams = overlayParams;
    this.handle = handle;
    this.notesMd = notesMd;
    this.metadataMd = metadataMd;
    // this.activeDefault = activeDefault ?? {};

    if (coordParams) {
      for (const o of coordParams) {
        this.coords[o.name] = new CoordsData(o);
      }
    }

    if (featureParams) {
      for (const f of featureParams) {
        switch (f.type) {
          case 'chunkedCSV':
            this.features[f.name] = new ChunkedCSV(f, false);
            break;
          case 'plainCSV':
            this.features[f.name] = new PlainCSV(f, false);
            break;
          default:
            throw new Error('Unsupported feature type at Sample.constructor');
        }
      }
    }

    if (autoHydrate) {
      this.hydrate().catch(console.error);
    }
  }

  get mPerPx() {
    return this.image?.mPerPx ?? 1;
  }

  /// Hydrates the sample, including the image and overlays (including their groups for the headers).
  async hydrate() {
    if (this.hydrated) return this;
    console.debug(`Hydrating ${this.name}.`);
    await Promise.all([
      this.image?.hydrate(this.handle),
      ...Object.values(this.features).map((o) => o.hydrate(this.handle))
    ]);
    this._deferred.resolve();
    this.hydrated = true;
    return this;
  }

  getFeature = genLRU(async (fn: FeatureAndGroup) => {
    const res = await this.features[fn.group]?.retrieve(fn.feature);

    if (!res || !res.data) {
      console.error(`getFeature: ${fn.feature} not found.`);
      return;
    }

    let coordKey: string;

    // Coordinates stuffs.
    let g: CoordsData;
    if (res.coordName) {
      coordKey = res.coordName;
      await this.coords[res.coordName].hydrate(this.handle);
      g = this.coords[res.coordName];
    } else {
      // Impossible for PlainCSV to have different coords per feature.
      // ChunkedCSV can because each feature retrieve can have its own coordName.
      coordKey =
        this.features[fn.group] instanceof PlainCSV ? fn.group : `${fn.group}-${fn.feature}`;
      // Gen coords.
      const mPerPx = res.mPerPx ?? this.image?.mPerPx;
      if (mPerPx == undefined) {
        console.error(`mPerPx is undefined at ${fn.feature}.`);
        return;
      }

      if (!('x' in res.data[0]) || !('y' in res.data[0])) {
        console.error("Feature doesn't have x or y.");
        return;
      }

      g = new CoordsData({
        name: coordKey,
        shape: 'circle',
        pos: res.data as unknown as Coord[],
        size: res.size,
        mPerPx
      });
    }

    // Transform value into array.
    let data: (number | string)[];
    if (typeof res.data[0] === 'number') {
      // Data can be in array from the densify function.
      data = res.data as unknown as number[];
    } else {
      const k = Object.keys(res.data[0]).length === 1 ? Object.keys(res.data[0])[0] : 'value';

      if (res.dataType === 'singular') {
        console.assert(
          Object.keys(res.data[0]).length === 2 && 'x' in res.data[0] && 'y' in res.data[0],
          'x and y not found in data.'
        );
        data = res.data.map(() => 1);
      } else {
        if (!(k in res.data[0])) throw new Error(`Feature ${fn.feature} doesn't have ${k}.`);
        data = res.data.map((o) => o[k]);
      }
    }

    const processed = {
      ...res,
      data,
      coords: g,
      minmax: stats({ key: coordKey, args: [data] }),
      name: fn
    };

    return processed;
  });

  async genFeatureList() {
    await this.promise;

    const featureList = [];
    for (const f of Object.values(this.features)) {
      if (f instanceof ChunkedCSV) {
        featureList.push({ group: f.name, features: Object.keys(f.names!) });
      } else if (f instanceof PlainCSV) {
        featureList.push({ group: f.name, features: f.features! });
      } else {
        throw new Error('Unsupported feature type at Sample.genFeatureList');
      }
    }
    return featureList;
  }
}
