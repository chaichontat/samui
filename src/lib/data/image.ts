import type { ImageMode } from '../mapp/imgControl';
import { Deferrable } from '../utils';
import { convertLocalToNetwork, type Data, type Url } from './dataHandlers';

export type ImageParams = { urls: Url[]; headerUrl?: Url; header?: ImageHeader };

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

export class Image extends Deferrable implements Data {
  urls: readonly Url[];
  coords?: readonly { x: number; y: number }[];
  channel?: Record<string, number>;
  header?: ImageHeader;
  headerUrl?: Url;
  n_spot?: number;
  hydrated = false;

  constructor({ urls, headerUrl, header }: ImageParams, autoHydrate = false) {
    super();
    this.urls = urls;
    this.headerUrl = headerUrl;
    this.header = header;

    if (!this.header && !this.headerUrl) throw new Error('No headerUrl or metadata provided');
    if (autoHydrate) {
      this.hydrate().catch(console.error);
    }
  }

  async hydrate(handle?: FileSystemDirectoryHandle) {
    if (!this.header && this.headerUrl) {
      if (handle) {
        this.headerUrl = await convertLocalToNetwork(handle, this.headerUrl);
        this.urls = await Promise.all(
          this.urls.map(async (url) => convertLocalToNetwork(handle, url))
        );
      }
      this.header = await fetch(this.headerUrl.url).then((r) => r.json() as Promise<ImageHeader>);
    }

    ({ channel: this.channel, coords: this.coords } = this.header!);
    this.n_spot = this.coords.length;
    this.hydrated = true;
    this._deferred.resolve();
    return this;
  }
}
