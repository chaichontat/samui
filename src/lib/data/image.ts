import { Deferrable } from '../utils';
import { convertLocalToNetwork, type Url } from './features';

export type ImageParams = {
  urls: Url[];
  channel: string[] | 'rgb';
  mPerPx: number;
};

export class Image extends Deferrable {
  urls: readonly Url[];
  channel: string[] | 'rgb';
  mPerPx: number;

  constructor({ urls, channel, mPerPx }: ImageParams, autoHydrate = false) {
    super();
    this.urls = urls;
    this.channel = channel;
    this.mPerPx = mPerPx;

    if (autoHydrate) {
      this.hydrate().catch(console.error);
    }
  }

  async hydrate(handle?: FileSystemDirectoryHandle) {
    if (handle) {
      this.urls = await Promise.all(
        this.urls.map(async (url) => convertLocalToNetwork(handle, url))
      );
    }

    this.hydrated = true;
    return this;
  }
}
