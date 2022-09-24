import { Deferrable } from '$src/lib/definitions';
import { genLRU, keyLRU } from '$src/lib/lru';
import { CoordsData, type Coord, type CoordsParams } from './coords';
import type { FeatureAndGroup, FeatureData, RetrievedData } from './feature';
import { ChunkedCSV, type ChunkedCSVParams } from './featureChunked';
import { PlainCSV, type PlainCSVParams } from './featurePlain';
import { ImgData, type ImageParams } from './image';

export type SampleParams = {
  name: string;
  imgParams?: ImageParams;
  coordParams?: CoordsParams[];
  featParams?: (PlainCSVParams | ChunkedCSVParams)[];
  handle?: FileSystemDirectoryHandle;
};

export class Sample extends Deferrable {
  name: string;
  imgParams?: ImageParams;
  coordsParams?: CoordsParams[];
  featureParams?: (PlainCSVParams | ChunkedCSVParams)[];

  features: Record<string, FeatureData> = {};
  coords: Record<string, CoordsData> = {};

  image?: ImgData;
  handle?: FileSystemDirectoryHandle;

  constructor(
    { name, imgParams, coordParams, featParams, handle }: SampleParams,
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
    this.handle = handle;
    // this.activeDefault = activeDefault ?? {};

    if (coordParams) {
      for (const o of coordParams) {
        this.coords[o.name] = new CoordsData(o);
      }
    }
    console.log(featureParams);

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

  /// Hydrates the sample, including the image and overlays (including their groups for the headers).
  async hydrate() {
    if (this.hydrated) return this;
    console.debug(`Hydrating ${this.name}.`);
    await Promise.all([
      this.image?.hydrate(this.handle),
      ...Object.values(this.coords).map((o) => o.hydrate(this.handle)),
      ...Object.values(this.features).map((o) => o.hydrate(this.handle))
    ]);
    this._deferred.resolve();
    this.hydrated = true;
    return this;
  }

  getFeature = genLRU(async (fn: FeatureAndGroup) => {
    const res =
      fn.group === 'Misc'
        ? await this.features[fn.feature]?.retrieve()
        : await this.features[fn.group]?.retrieve(fn.feature);

    if (!res || !res.data) {
      console.error(`getFeature: ${fn.feature} not found.`);
      return;
    }

    const key = `${fn.group}-${fn.feature}`;

    // Coordinates stuffs.
    let g: CoordsData;
    if (res.coordName) {
      g = this.coords[res.coordName];
    } else {
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
        name: key,
        shape: 'circle',
        pos: res.data as unknown as Coord[],
        size: res.size,
        mPerPx
      });
    }

    // Transform value into array.
    // Data can be in array form from the densify function.
    let data: (number | string)[];
    if (typeof res.data[0] === 'number') {
      data = res.data as unknown as number[];
    } else {
      const k = Object.keys(res.data[0]).length === 1 ? Object.keys(res.data[0])[0] : 'value';
      if (!(k in res.data[0])) {
        throw new Error('value not found in CSV for ChunkedCSV with coord in feature.');
      }
      data = res.data.map((o) => o[k]);
    }
    return { ...res, data, coords: g };
  });

  genFeatureList() {
    const featureList = [];
    const misc = [];
    for (const f of Object.values(this.features)) {
      if (f instanceof ChunkedCSV) {
        featureList.push({ group: f.name, features: Object.keys(f.names!) });
      } else if (f instanceof PlainCSV) {
        misc.push(f.name);
      } else {
        throw new Error('Unsupported feature type at Sample.genFeatureList');
      }
    }
    featureList.push({ group: 'Misc', features: misc });
    return featureList;
  }
}
