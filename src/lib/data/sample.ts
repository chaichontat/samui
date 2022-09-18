import { Deferrable } from '../utils';
import type { FeatureAndGroup } from './features';
import { Image, type ImageParams } from './image';
import { OverlayData, type OverlayParams } from './overlay';

export type SampleParams = {
  name: string;
  imgParams?: ImageParams;
  overlayParams?: OverlayParams[];
  handle?: FileSystemDirectoryHandle;
  activeDefault?: FeatureAndGroup;
};

export class Sample extends Deferrable {
  name: string;
  imgParams?: ImageParams;
  overlayParams?: OverlayParams[];

  overlays: Record<string, OverlayData>;
  image?: Image;
  handle?: FileSystemDirectoryHandle;
  activeDefault: FeatureAndGroup;

  constructor(
    { name, imgParams, overlayParams, handle, activeDefault }: SampleParams,
    autoHydrate = false
  ) {
    super();
    this.name = name;
    this.imgParams = imgParams;
    if (this.imgParams) {
      this.image = new Image(this.imgParams, false);
    }
    this.overlayParams = overlayParams;
    this.handle = handle;
    this.activeDefault = activeDefault ?? {};

    this.overlays = {} as Record<string, OverlayData>;

    if (overlayParams) {
      for (const o of overlayParams) {
        this.overlays[o.name] = new OverlayData(o);
      }
    }

    if (autoHydrate) {
      this.hydrate().catch(console.error);
    }
  }

  /// Hydrates the sample, including the image and overlays (including their groups for the headers).
  async hydrate() {
    if (this.hydrated) return this;
    console.debug(`Hydrating ${this.name}.`);
    await Promise.all([
      this.image?.hydrate(this.handle),
      ...Object.values(this.overlays).map((o) => o.hydrate(this.handle))
    ]);

    this.hydrated = true;
    return this;
  }
}
