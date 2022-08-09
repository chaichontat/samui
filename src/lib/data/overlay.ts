import { fromCSV } from '../io';
import { Deferrable } from '../utils';
import {
  ChunkedJSON,
  convertLocalToNetwork,
  PlainJSON,
  PlainJSONGroup,
  type Coord,
  type FeatureAndGroup,
  type FeatureData,
  type FeatureParams,
  type Url
} from './features';

type Shape = 'circle';

export interface OverlayParams {
  name: string;
  shape: Shape;
  url?: Url;
  size?: number;
  mPerPx?: number;
  pos?: Coord[];
  features?: FeatureParams[];
  addedOnline?: boolean;
}

export class OverlayData extends Deferrable {
  url?: Url;
  readonly name: string;
  shape: Shape;
  pos?: Coord[];
  size?: number;
  mPerPx?: number;
  groups: Record<string, FeatureData>;
  addedOnline: boolean;

  constructor(
    { name, shape, url, size, mPerPx, pos, features, addedOnline }: OverlayParams,
    autoHydrate = false
  ) {
    super();
    this.name = name;
    this.shape = shape;
    this.url = url;
    this.pos = pos;
    this.size = size;
    this.mPerPx = mPerPx;
    this.addedOnline = addedOnline ?? false;
    this.groups = {};

    if (!this.url && !this.pos) throw new Error('Must provide url or value');
    if (features) {
      this.groups = OverlayData._parseFeature(features);
    }
    if (autoHydrate) {
      this.hydrate().catch(console.error);
    }
  }

  get sizePx() {
    if (!this.mPerPx) throw new Error('Must provide mPerPx');
    // Defaults to 20 for objects without size.
    return this.size ? this.size / this.mPerPx : 20;
  }

  static _parseFeature(featParams: FeatureParams[]) {
    const featgroups = {} as Record<string, FeatureData>;
    const nogroup = [] as PlainJSON[];
    for (const f of featParams) {
      if (f.name === 'nogroup') {
        alert('Cannot have a feature with name "nogroup"');
        throw new Error('Cannot have a feature with name "nogroup"');
      }
      switch (f.type) {
        case 'chunkedJSON':
          featgroups[f.name] = new ChunkedJSON(f, false);
          break;
        case 'plainJSON':
          nogroup.push(new PlainJSON(f, false));
          break;
        default:
          throw new Error('Unsupported feature type at Sample.constructor');
      }
    }

    featgroups.nogroup = new PlainJSONGroup({ name: '', plainjsons: nogroup });
    return featgroups;
  }

  async hydrate(handle?: FileSystemDirectoryHandle) {
    if (!this.pos && this.url) {
      if (handle) {
        this.url = await convertLocalToNetwork(handle, this.url);
      }
      const promise = fromCSV(this.url.url, { download: true }).then(
        (x) => (this.pos = x?.data as Coord[])
      );
      // Hydrate groups as well.
      const promises: Promise<any>[] = Object.values(this.groups).map((g) => g.hydrate());
      promises.push(promise);
      await Promise.all(promises);
    } else {
      console.info(`Overlay ${this.name} has no url or pos.`);
    }
    this.pos!.forEach((p, i) => (p.idx = i));
    this.hydrated = true;
    return this;
  }

  get featNames() {
    const out = [];
    for (const [g, feat] of Object.entries(this.groups)) {
      if (feat.featNames) {
        out.push({ group: g, features: feat.featNames });
      }
    }
    return out;
  }

  async getFeature(fn: FeatureAndGroup) {
    return await this.groups[fn.group]?.retrieve(fn.feature);
  }
}
