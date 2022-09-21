import { fromCSV } from '../io';
import { Deferrable, getFile } from '../utils';

export type Url = { url: string; type: 'local' | 'network' };
export type Coord = { x: number; y: number; id?: string; idx: number };

// If ChunkedJSON, feature and name.
// If PlainJSON, only name.
export type FeatureAndGroup = {
  readonly group: string;
  readonly feature: string;
};

export type DataType = 'categorical' | 'quantitative';
export type RetrievedData = (number | string)[] | Record<string, number | string> | Coord[];

export interface FeatureValues {
  dataType: 'quantitative' | 'categorical';
  data: RetrievedData;
}

interface CSVParams {
  name: string;
  dataType: DataType;
}

export interface PlainCSVParams extends CSVParams {
  type: 'plainCSV';
  url?: Url;
  values?: RetrievedData;
  coordName?: string;
}

export type Sparse = { index: number; value: number }[];

export interface FeatureData extends Deferrable {
  readonly name: string;
  featNames?: string[];

  hydrate: (handle?: FileSystemDirectoryHandle) => Promise<this>;
  retrieve(name?: string | number): Promise<FeatureValues | undefined>;
}

export class PlainJSONGroup extends Deferrable implements FeatureData {
  name = '';
  plainjsons: Record<string | number, PlainCSV>;
  featNames: string[];

  constructor({ name, plainjsons }: { name: string; plainjsons: PlainCSV[] }, autoHydrate = false) {
    super();
    this.name = name;
    this.plainjsons = {};
    this.featNames = [];
    for (const p of plainjsons) {
      this.plainjsons[p.name] = p;
      this.featNames.push(p.name);
    }

    if (autoHydrate) {
      this.hydrate().catch(console.error);
    }
    this._deferred.resolve();
  }

  async hydrate(): Promise<this> {
    if (this.hydrated) {
      return this;
    }
    for (const p of Object.values(this.plainjsons)) {
      await p.hydrate();
    }
    this.hydrated = true;
    return this;
  }

  async retrieve(name: string) {
    return await this.plainjsons[name]?.retrieve();
  }
}

export class PlainCSV extends Deferrable implements FeatureData {
  url?: Url;

  readonly name: string;
  readonly dataType: DataType;
  readonly coordName: string | undefined;
  values?: RetrievedData;

  constructor({ name, url, dataType, values, coordName }: PlainCSVParams, autoHydrate = false) {
    super();
    this.name = name;
    this.url = url;
    this.values = values;
    this.dataType = dataType;
    this.coordName = coordName;

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
      const v = retrieved.data as { [key: string]: number | string }[];
      if (Object.keys(v[0]).length === 1) {
        const key = Object.keys(v[0])[0];
        this.values = v.map((d) => d[key]);
      } else {
        console.error('CSV must have only one column.');
        // throw new Error('Cannot handle multiple columns');
      }
    }
    this.hydrated = true;
    return this;
  }

  async retrieve() {
    if (!this.hydrated) {
      await this.hydrate();
    }
    return { dataType: this.dataType, data: this.values!, coordName: this.coordName };
  }
}

export async function convertLocalToNetwork(
  handle: FileSystemDirectoryHandle,
  url: Url
): Promise<Url> {
  if (url.type === 'local') {
    return { url: URL.createObjectURL(await getFile(handle, url.url)), type: 'network' };
  }
  return url;
}

export function convertCategoricalToNumber(values: (string | number)[]) {
  const unique = [...new Set(values)];
  const legend = {} as Record<number | string, number>;
  const legendArr = [] as (number | string)[];
  for (const [i, v] of unique.sort().entries()) {
    legend[v] = i;
    legendArr.push(v);
  }
  const converted = values.map((v) => legend[v]);
  return { legend: legendArr, converted };
}

// export class Arrow implements Data {
//   keys: (string | number | symbol)[] | undefined;
//   private readonly data: Record<string, TypedArray>;

//   constructor(private readonly url: string, autoHydrate = false) {
//     this.url = url;
//     this.data = {} as Record<string, TypedArray>;

//     if (autoHydrate) {
//       this.hydrate().catch(console.error);
//     }
//   }

//   retrieve(name: string): TypedArray | undefined {
//     return this.data[name];
//   }

//   async hydrate() {
//     const table = await fetch(this.url).then((r) => tableFromIPC(r));
//     this.keys = table.schema.names;
//     for (const name of table.schema.names) {
//       this.data[name as string] = table.getChild(name)!.toArray() as Float32Array;
//     }
//     return this;
//   }
// }
