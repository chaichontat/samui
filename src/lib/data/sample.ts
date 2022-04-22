import { ChunkedJSON, PlainJSON, type Data, type FeatureParams } from './dataHandlers';
import { Image, type ImageParams } from './image';

export type SampleParams = {
  name: string;
  imgParams: ImageParams;
  featParams: FeatureParams[];
  handle?: FileSystemDirectoryHandle;
};

export class Sample {
  name: string;
  imgParams: ImageParams;
  featParams: FeatureParams[];

  image: Image;
  features: Record<string, Data>;
  hydrated: boolean;
  handle?: FileSystemDirectoryHandle;

  constructor({ name, imgParams, featParams, handle }: SampleParams, autoHydrate = false) {
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

    if (autoHydrate) {
      this.hydrate().catch(console.error);
    }
  }

  async hydrate() {
    await Promise.all([
      this.image.hydrate(this.handle),
      ...Object.values(this.features).map((f) => f.hydrate(this.handle))
    ]);
    this.hydrated = true;
    return this;
  }
}
