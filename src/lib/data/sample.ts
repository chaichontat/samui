import { Deferrable } from '../utils';
import { ChunkedCSV, type ChunkedCSVParams } from './chunked';
import { CoordsData, type CoordsParams } from './coord';
import { PlainCSV, type FeatureAndGroup, type PlainCSVParams } from './features';
import { Image, type ImageParams } from './image';

type FeatureParams = ChunkedCSVParams | PlainCSVParams;

export type SampleParams = {
  name: string;
  imgParams?: ImageParams;
  coordParams?: CoordsParams[];
  featParams?: FeatureParams[];
  handle?: FileSystemDirectoryHandle;
  activeDefault?: FeatureAndGroup;
};

export class Sample extends Deferrable {
  name: string;
  imgParams?: ImageParams;
  coordsParams?: CoordsParams[];
  featureParams?: FeatureParams[];

  features: Record<string, ChunkedCSV | PlainCSV> = {};
  coords: Record<string, CoordsData> = {};

  image?: Image;
  handle?: FileSystemDirectoryHandle;
  activeDefault: FeatureAndGroup;

  constructor(
    { name, imgParams, coordParams, featParams, handle, activeDefault }: SampleParams,
    autoHydrate = false
  ) {
    super();
    this.name = name;
    this.imgParams = imgParams;
    if (this.imgParams) {
      this.image = new Image(this.imgParams, false);
    }
    // TODO: Rename on Python side.
    const featureParams = featParams;
    this.coordsParams = coordParams;
    this.featureParams = featureParams;
    this.handle = handle;
    this.activeDefault = activeDefault ?? {};

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

    this.hydrated = true;
    return this;
  }

  async getFeature(fn: FeatureAndGroup) {
    const f =
      fn.group === 'Misc'
        ? await this.features[fn.feature]?.retrieve()
        : await this.features[fn.group]?.retrieve(fn.feature);
    if (!f || !f.data) {
      console.error(`getFeature: ${fn.feature} not found.`);
      return;
    }
    return f;
  }

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
