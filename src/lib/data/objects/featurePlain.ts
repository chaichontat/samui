import { Deferrable } from '$src/lib/definitions';
import { convertLocalToNetwork, fromCSV, type Url } from '$src/lib/io';
import type { CSVRetrievedData, FeatureParams, FeatureType } from './feature';

export interface PlainCSVParams extends FeatureParams {
  type: 'plainCSV';
  url?: Url;
  values?: CSVRetrievedData;
  coordName?: string;
  mPerPx?: number;
  size?: number;
}

export class PlainCSV extends Deferrable {
  url?: Url;

  readonly name: string;
  readonly dataType: FeatureType;
  readonly coordName: string | undefined;
  readonly mPerPx: number | undefined;
  readonly size: number | undefined;
  values?: CSVRetrievedData;

  constructor(
    { name, url, dataType, values, coordName, mPerPx, size }: PlainCSVParams,
    autoHydrate = false
  ) {
    super();
    this.name = name;
    this.url = url;
    this.values = values;
    this.dataType = dataType;
    this.coordName = coordName;
    this.mPerPx = mPerPx;
    this.size = size;

    if (!this.url && !this.values) throw new Error('Must provide url or value');
    if (autoHydrate) {
      this.hydrate().catch(console.error);
    }
  }

  async hydrate(handle?: FileSystemDirectoryHandle) {
    if (this.hydrated) return this;
    if (!this.values && this.url) {
      if (handle) {
        this.url = await convertLocalToNetwork(handle, this.url);
      }
      const retrieved = await fromCSV(this.url.url, { download: true });
      if (!retrieved) {
        console.error(`Cannot fetch ${this.url.url}.`);
        return this;
      }

      this.values = retrieved.data as Record<string, number | string>[];
      //   if (Object.keys(v[0]).length === 1) {
      //     const key = Object.keys(v[0])[0];
      //     this.values = v.map((d) => d[key]);
      //   } else {
      //     console.error('CSV must have only one column.');
      //     // throw new Error('Cannot handle multiple columns');
      //   }
    }
    this.hydrated = true;
    return this;
  }

  async retrieve() {
    if (!this.hydrated) {
      await this.hydrate();
    }
    return {
      dataType: this.dataType,
      data: this.values!,
      coordName: this.coordName,
      mPerPx: this.mPerPx,
      size: this.size
    };
  }
}
