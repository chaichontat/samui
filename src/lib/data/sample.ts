import type { FeatureName } from '../store';
import { Deferrable } from '../utils';
import { ChunkedJSON, PlainJSON, type Data, type FeatureParams } from './dataHandlers';
import { Image, type ImageParams } from './image';

export type SampleParams = {
  name: string;
  imgParams: ImageParams;
  featParams: FeatureParams[];
  handle?: FileSystemDirectoryHandle;
};

export class Sample extends Deferrable implements Data {
  name: string;
  imgParams: ImageParams;
  featParams: FeatureParams[];

  image: Image;
  features: Record<string, Data>;
  hydrated: boolean;
  handle?: FileSystemDirectoryHandle;
  activeFeature?: FeatureName<string>;

  constructor({ name, imgParams, featParams, handle }: SampleParams, autoHydrate = false) {
    super();
    this.name = name;
    this.imgParams = imgParams;
    this.image = new Image(this.imgParams, false);
    this.featParams = featParams;
    this.hydrated = false;
    this.handle = handle;

    this.features = {} as Record<string, Data>;
    for (const f of featParams) {
      switch (f.type) {
        case 'chunkedJSON':
          this.features[f.name] = new ChunkedJSON(f, false);
          break;
        case 'plainJSON':
          this.features[f.name] = new PlainJSON(f, false);
          break;
        default:
          throw new Error('Unsupported feature type at Sample.constructor');
      }
    }

    this.features._selections = new PlainJSON({
      name: 'selections',
      dataType: 'categorical',
      values: [] as string[],
      type: 'plainJSON',
      activeDefault: ''
    });

    if (autoHydrate) {
      this.hydrate().catch(console.error);
    }
  }

  async hydrate() {
    await Promise.all([
      this.image.hydrate(this.handle),
      ...Object.values(this.features).map((f) => f.hydrate(this.handle))
    ]);
    (this.features._selections as PlainJSON).values = new Array(this.image.coords!.length).fill('');
    this.hydrated = true;
    this._deferred.resolve();
    return this;
  }

  getFeature(fn: FeatureName<string>) {
    let values;
    let feature;
    if (fn.feature) {
      feature = this.features[fn.feature] as ChunkedJSON;
      values = feature?.retrieve!(fn.name) as Promise<number[] | string[]>;
    } else {
      feature = this.features[fn.name] as PlainJSON;
      values = feature?.values as number[] | string[];
    }
    return { values, dataType: feature?.dataType ?? 'quantitative' };
  }
}
