import { ChunkedJSON, PlainJSON } from './dataHandlers';

type ChunkedJSONParams = { type: 'chunkedJSON'; name: string; url: string; headerUrl: string };
type ArrowParams = { type: 'arrow'; name: string; url: string };
type PlainJSONParams = { type: 'plainJSON'; name: string; url: string };
export type ImageParams = { urls: string[]; headerUrl: string };

export type FeatureParams = ChunkedJSONParams | ArrowParams | PlainJSONParams;

export type SpotParams = {
  spotDiam: number;
  mPerPx: number;
};

export type ImageMetadata = {
  sample: string;
  coords: { x: number; y: number }[];
  channel: Record<string, number>;
  spot: SpotParams;
};

export class Image {
  coords: { x: number; y: number }[] | undefined;
  channel: Record<string, number> | undefined;
  metadata: ImageMetadata | undefined;
  n_spot: number | undefined;

  constructor(readonly urls: string[], readonly headerURL: string, autoHydrate = true) {
    this.urls = urls;
    this.headerURL = headerURL;

    if (autoHydrate) {
      this.hydrate().catch(console.error);
    }
  }

  async hydrate() {
    this.metadata = await fetch(this.headerURL).then((r) => r.json() as Promise<ImageMetadata>);

    ({ channel: this.channel, coords: this.coords } = this.metadata!);
    this.n_spot = this.coords.length;
    // const coordsTable = await fetch(this.params.coordsUrl).then((r) => tableFromIPC(r));
    // this.coords = coordsTable.toArray().map((row) => row!.toJSON()) as { x: number; y: number }[];
    return this;
  }
}

export class Sample {
  image: Image;
  features: Record<string, ChunkedJSON | PlainJSON>;

  constructor(
    readonly name: string,
    readonly imgParams: ImageParams,
    readonly featParams: FeatureParams[]
  ) {
    this.name = name;
    this.imgParams = imgParams;
    this.featParams = featParams;

    this.image = new Image(imgParams.urls, imgParams.headerUrl, false);
    this.features = {} as Record<string, ChunkedJSON | PlainJSON>;
    for (const f of featParams) {
      switch (f.type) {
        case 'chunkedJSON':
          this.features[f.name] = new ChunkedJSON(f.headerUrl, f.url, false);
          break;
        case 'plainJSON':
          this.features[f.name] = new PlainJSON(f.url, false);
          break;
        default:
          throw new Error('Unsupported feature type at Sample.constructor');
          break;
      }
    }
    this.hydrate().catch(console.error);
  }

  async hydrate() {
    await Promise.all([
      this.image.hydrate(),
      ...Object.values(this.features).map((f) => f.hydrate())
    ]);
    return this;
  }
}
