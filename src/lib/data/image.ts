import type { BandInfo } from '../mapp/imgControl';
import { Deferrable } from '../utils';
import { convertLocalToNetwork, type Url } from './features';

export type ImageParams = {
  urls: Url[];
  channels: string[] | 'rgb';
  mPerPx: number;
  defaultChannels?: Record<string, BandInfo['color']>;
};

export class Image extends Deferrable {
  urls: readonly Url[];
  channels: string[] | 'rgb';
  defaultChannels: Record<string, BandInfo['color']>;
  mPerPx: number;

  constructor({ urls, channels, defaultChannels, mPerPx }: ImageParams, autoHydrate = false) {
    super();
    this.urls = urls;
    this.channels = channels;
    this.defaultChannels = defaultChannels ?? {};
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
