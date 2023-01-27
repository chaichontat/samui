import { Deferrable } from '$src/lib/definitions';
import { convertLocalToNetwork, fromCSV, type Url } from '$src/lib/io';
import { difference } from 'lodash-es';
import type { CSVRetrievedData, FeatureParams, FeatureType } from './feature';

export interface PlainCSVParams extends FeatureParams {
  type: 'plainCSV';
  url?: Url;
  values?: CSVRetrievedData;
  coordName?: string;
  mPerPx?: number;
  size?: number;
  unit?: string;
}

export class PlainCSV extends Deferrable {
  url?: Url;

  readonly name: string;
  readonly dataType: FeatureType;
  readonly coordName: string | undefined;
  readonly mPerPx: number | undefined;
  readonly size: number | undefined;
  readonly unit: string | undefined;
  features?: string[];
  featNames: string[] = [];
  values?: CSVRetrievedData;

  constructor(
    { name, url, dataType, values, coordName, mPerPx, size, unit }: PlainCSVParams,
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
    this.unit = unit;

    if (!this.url && !this.values) throw new Error('Must provide url or value');
    if (autoHydrate) {
      this.hydrate().catch(console.error);
    }
  }

  async hydrate(handle?: FileSystemDirectoryHandle) {
    if (this.hydrated) return this;
    console.debug('plaincsv hydrating', this.name);
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
      this.features = difference(Object.keys(this.values[0]), ['id', 'idx', 'x', 'y']);
    }

    // To maintain consistency with ChunkedCSV.
    this.featNames = Object.keys(this.features).map((s) => s.toString());
    this.hydrated = true;
    return this;
  }

  async retrieve(feature: string) {
    if (!this.hydrated) {
      await this.hydrate();
    }

    if (!this.values) {
      console.error(`Cannot retrieve ${feature}.`);
    }

    let k: string;
    if (feature.includes(feature)) {
      k = feature;
    } else if (feature.includes('value')) {
      k = 'value';
    } else if (feature.includes(this.name)) {
      k = this.name;
    } else {
      console.error(`Feature ${feature} not found.`);
      return;
    }

    return {
      dataType: this.dataType,
      data: this.values!.map((o) => ({ x: o.x, y: o.y, value: o[k] })),
      coordName: this.coordName,
      mPerPx: this.mPerPx,
      size: this.size,
      unit: this.unit
    };
  }
}
