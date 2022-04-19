import type { ImageMode } from '../mapp/imgControl';

export type ImageParams = { urls: string[]; headerUrl?: string; header?: ImageHeader };

export type SpotParams = {
  spotDiam: number;
  mPerPx: number;
};

export type ImageHeader = {
  sample: string;
  coords: readonly { x: number; y: number }[];
  channel: Record<string, number>;
  spot: SpotParams;
  mode?: ImageMode;
};

export class Image {
  urls: readonly string[];
  coords?: readonly { x: number; y: number }[];
  channel?: Record<string, number>;
  header?: ImageHeader;
  headerUrl?: string;
  n_spot?: number;

  constructor({ urls, headerUrl, header }: ImageParams, autoHydrate = false) {
    this.urls = urls;
    this.headerUrl = headerUrl;
    this.header = header;

    if (!this.header && !this.headerUrl) throw new Error('No headerUrl or metadata provided');
    if (autoHydrate) {
      this.hydrate().catch(console.error);
    }
  }

  async hydrate() {
    if (!this.header && this.headerUrl) {
      this.header = await fetch(this.headerUrl).then((r) => r.json() as Promise<ImageHeader>);
    }
    ({ channel: this.channel, coords: this.coords } = this.header!);
    this.n_spot = this.coords.length;
    return this;
  }
}
