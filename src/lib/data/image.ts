import type { ImageMode } from '../mapp/imgControl';
import { Deferrable } from '../utils';
import { convertLocalToNetwork, type Url } from './features';

export type ImageParams = {
  urls: Url[];
  channel: Record<string, number>;
  mPerPx: number;
  mode: ImageMode;
};

export class Image extends Deferrable {
  urls: readonly Url[];
  channel: Record<string, number>;
  mPerPx: number;
  mode: ImageMode;

  hydrated = false;

  constructor({ urls, channel, mPerPx, mode }: ImageParams, autoHydrate = false) {
    super();
    this.urls = urls;
    this.channel = channel;
    this.mPerPx = mPerPx;
    this.mode = mode;

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
    this._deferred.resolve();
    return this;
  }
}
