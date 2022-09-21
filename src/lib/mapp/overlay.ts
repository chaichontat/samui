import { sOverlay, sSample } from '$lib/store';
import type { Layer } from 'ol/layer';
import { get } from 'svelte/store';

export class Overlay {
  readonly uid: string;
  readonly layer: Layer;
  _coordName: string | undefined;
  _featureName: string | undefined;

  constructor(layer: Layer) {
    this.uid = Math.random().toString(36).substring(2, 9);
    this.layer = layer;
  }

  get coordName() {
    return this._coordName;
  }

  set coordName(name: string) {
    if (name === this._coordName) {
      return;
    }

    get(sSample)
      .coords[name].hydrate()
      .then(() => {
        this._coordName = name;
      })
      .catch(console.error);
  }

  update() {}

  // get sizePx() {
  //   if (!this.mPerPx) throw new Error('Must provide mPerPx');
  //   // Defaults to 20 for objects without size.
  //   return this.size ? this.size / this.mPerPx : 20;
  // }

  // static _parseFeature(featParams: FeatureParams[]) {
  //   const featgroups = {} as Record<string, FeatureData>;
  //   const nogroup = [] as PlainCSV[];
  //   for (const f of featParams) {
  //     if (f.name === 'nogroup') {
  //       alert('Cannot have a feature with name "nogroup"');
  //       throw new Error('Cannot have a feature with name "nogroup"');
  //     }
  //     switch (f.type) {
  //       case 'chunkedJSON':
  //         featgroups[f.name] = new ChunkedJSON(f, false);
  //         break;
  //       case 'plainJSON':
  //         nogroup.push(new PlainCSV(f, false));
  //         break;
  //       default:
  //         throw new Error('Unsupported feature type at Sample.constructor');
  //     }
  //   }

  //   featgroups.nogroup = new PlainJSONGroup({ name: '', plainjsons: nogroup });
  //   return featgroups;
  // }

  // async hydrate(handle?: FileSystemDirectoryHandle) {
  //   if (!this.pos && this.url) {
  //     if (handle) {
  //       this.url = await convertLocalToNetwork(handle, this.url);
  //     }
  //     const promise = fromCSV(this.url.url, { download: true }).then(
  //       (x) => (this.pos = x?.data as Coord[])
  //     );
  //     // Hydrate groups as well.
  //     const promises: Promise<any>[] = Object.values(this.groups).map((g) => g.hydrate());
  //     promises.push(promise);
  //     await Promise.all(promises);
  //   } else {
  //     console.info(`Overlay ${this.name} has no url or pos.`);
  //   }
  //   this.pos!.forEach((p, i) => (p.idx = i));
  //   this.hydrated = true;
  //   return this;
  // }

  // get featNames() {
  //   const out = [];
  //   for (const [g, feat] of Object.entries(this.groups)) {
  //     if (feat.featNames) {
  //       out.push({ group: g, features: feat.featNames });
  //     }
  //   }
  //   return out;
  // }
}
