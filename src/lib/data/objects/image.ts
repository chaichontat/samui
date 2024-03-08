import { Deferrable } from '$src/lib/definitions';
import { convertLocalToNetwork, type Url } from '$src/lib/io';
import type { BandInfo } from '$src/lib/ui/background/imgColormap';

export type ImageParams = {
  urls: Url[];
  channels: string[] | 'rgb';
  mPerPx: number;
  defaultChannels?: Record<BandInfo['color'], string | undefined>;
  dtype?: 'uint8' | 'uint16';
  maxVal?: number;
};

export class ImgData extends Deferrable {
  urls: readonly Url[];
  channels: string[] | 'rgb';
  defaultChannels: Record<BandInfo['color'], string | undefined>;
  mPerPx: number;
  maxVal: number;

  constructor(
    { urls, channels, defaultChannels, mPerPx, maxVal }: ImageParams,
    autoHydrate = false
  ) {
    super();
    this.urls = urls;
    this.maxVal = maxVal ?? 255;

    // WebGL limitation
    if (Array.isArray(channels) && !channels.every((c) => /^[a-z0-9_]+$/i.test(c))) {
      console.error('Channel name must be alphanumeric.', channels);
      alert(`Channel name must be alphanumeric. Current ones are ${channels.join(', ')}`);
    }

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
