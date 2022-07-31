import { Deferrable } from '../utils';
import {
  ChunkedJSON,
  PlainJSON,
  PlainJSONGroup,
  type FeatureAndGroup,
  type FeatureData,
  type FeatureParams,
  type RetrievedData
} from './features';
import { Image, type ImageParams } from './image';
import { OverlayData, type OverlayParams } from './overlay';

export type SampleParams = {
  name: string;
  imgParams: ImageParams;
  overlayParams?: OverlayParams[];
  featParams?: FeatureParams<RetrievedData>[];
  handle?: FileSystemDirectoryHandle;
  activeDefault?: FeatureAndGroup;
};

export class Sample extends Deferrable {
  name: string;
  imgParams: ImageParams;
  overlayParams?: OverlayParams[];
  featParams?: FeatureParams<RetrievedData>[];

  image: Image;
  groups: Record<string, FeatureData>;
  overlays: Record<string, OverlayData>;
  hydrated: boolean;
  handle?: FileSystemDirectoryHandle;
  activeDefault: FeatureAndGroup;

  constructor(
    { name, imgParams, featParams, overlayParams, handle, activeDefault }: SampleParams,
    autoHydrate = false
  ) {
    super();
    this.name = name;
    this.imgParams = imgParams;
    this.image = new Image(this.imgParams, false);
    this.featParams = featParams;
    this.overlayParams = overlayParams;
    this.hydrated = false;
    this.handle = handle;
    this.activeDefault = activeDefault ?? {};

    this.overlays = {} as Record<string, OverlayData>;

    if (overlayParams) {
      for (const o of overlayParams) {
        this.overlays[o.name] = new OverlayData(o);
      }
    }

    this.groups = {} as Record<string, FeatureData>;
    if (featParams) {
      for (const f of featParams) {
        switch (f.type) {
          case 'chunkedJSON':
            this.groups[f.name] = new ChunkedJSON(f, false);
            break;
          case 'plainJSON':
            this.groups[f.name] = new PlainJSON(f, false);
            break;
          default:
            throw new Error('Unsupported feature type at Sample.constructor');
        }
      }
    }

    // this.features._selections = new PlainJSON({
    //   name: 'selections',
    //   dataType: 'categorical',
    //   values: [] as string[],
    //   type: 'plainJSON',
    // });

    if (autoHydrate) {
      this.hydrate().catch(console.error);
    }
  }

  async hydrate() {
    console.debug(`Hydrating ${this.name}.`);
    await Promise.all([
      this.image.hydrate(this.handle),
      ...Object.values(this.groups).map((f) => f.hydrate(this.handle)),
      ...Object.values(this.overlays).map((o) => o.hydrate(this.handle))
    ]);

    if (!this.activeDefault.feature && this.featParams) {
      const f = this.featParams[0].name;
      if (this.groups[f] instanceof PlainJSON) {
        this.activeDefault.feature = f;
      } else {
        this.activeDefault.group = f;
        this.activeDefault.feature = (this.groups[f] as ChunkedJSON<RetrievedData>).activeDefault;
      }
    }
    this.hydrated = true;
    this._deferred.resolve();
    return this;
  }

  async getFeature(fn: FeatureAndGroup) {
    if (!fn?.feature)
      return { values: undefined, dataType: 'quantitative', activeDefault: undefined };

    const feature = this.groups[fn.group];
    const values = await feature?.retrieve(fn.feature);

    return {
      values: values?.data,
      dataType: values?.dataType ?? 'quantitative',
      activeDefault: undefined,
      overlay: feature?.overlay
    };
  }
}
