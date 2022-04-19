import { ChunkedJSON, PlainJSON, type Data, type FeatureParams } from './dataHandlers';
import { Image, type ImageParams } from './image';

export type SampleParams = {
  name: string;
  imgParams: ImageParams;
  featParams: FeatureParams[];
};

export class Sample {
  name: string;
  imgParams: ImageParams;
  featParams: FeatureParams[];

  image: Image;
  features: Record<string, Data>;
  protected hydrated: boolean;

  constructor({ name, imgParams, featParams }: SampleParams, autoHydrate = false) {
    this.name = name;
    this.imgParams = imgParams;
    this.image = new Image(this.imgParams, false);
    this.featParams = featParams;
    this.hydrated = false;

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

    if (autoHydrate) {
      this.hydrate().catch(console.error);
    }
  }

  async hydrate() {
    await Promise.all([
      this.image.hydrate(),
      ...Object.values(this.features).map((f) => f.hydrate())
    ]);
    return this;
  }
}
