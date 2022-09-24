import { Deferrable } from '$src/lib/definitions';
import { convertLocalToNetwork, type Url } from '$src/lib/io';
import type { BandInfo } from '$src/lib/ui/background/imgColormap';

export type ImageParams = {
  urls: Url[];
  channels: string[] | 'rgb';
  mPerPx: number;
  defaultChannels?: Record<string, BandInfo['color']>;
};

export class ImgData extends Deferrable {
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

  get mode() {
    return this.channels === 'rgb' ? 'rgb' : Array.isArray(this.channels) ? 'composite' : undefined;
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
