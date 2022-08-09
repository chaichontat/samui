import { browser } from '$app/env';
import pako from 'pako';
import { Deferrable, genLRU, getFile, oneLRU } from '../utils';

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
type SparseMode = 'record' | 'array' | null;

export interface FeatureValues {
  dataType: 'quantitative' | 'categorical';
  data: RetrievedData;
}

interface JSONParams {
  name: string;
  dataType: DataType;
  overlay?: string;
}

export interface PlainJSONParams extends JSONParams {
  type: 'plainJSON';
  url?: Url;
  values?: RetrievedData;
}

export interface ChunkedJSONParams extends JSONParams {
  type: 'chunkedJSON';
  url: Url;
  headerUrl?: Url;
  header?: ChunkedJSONHeader;
}

export type ChunkedJSONHeader = {
  length: number;
  names: Record<string, number> | null;
  ptr: number[];
  activeDefault?: string;
  sparseMode?: SparseMode;
};

export type FeatureParams = ChunkedJSONParams | PlainJSONParams;
export type Sparse = { index: number[]; value: number[] };

export interface FeatureData extends Deferrable {
  readonly name: string;
  readonly overlay?: string;
  featNames?: string[];

  hydrate: (handle?: FileSystemDirectoryHandle) => Promise<this>;
  retrieve(name?: string | number): Promise<FeatureValues | undefined>;
}

export class PlainJSONGroup extends Deferrable implements FeatureData {
  name = '';
  plainjsons: Record<string | number, PlainJSON>;
  featNames: string[];

  constructor(
    { name, plainjsons }: { name: string; plainjsons: PlainJSON[] },
    autoHydrate = false
  ) {
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

export class PlainJSON extends Deferrable implements FeatureData {
  url?: Url;

  readonly name: string;
  readonly dataType: DataType;

  values?: RetrievedData;

  constructor({ name, url, dataType, values }: PlainJSONParams, autoHydrate = false) {
    super();
    this.name = name;
    this.url = url;
    this.values = values;
    this.dataType = dataType;

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
      this.values = (await fetch(this.url.url).then((r) => r.json())) as RetrievedData;
    }
    this.hydrated = true;
    return this;
  }

  async retrieve() {
    if (!this.hydrated) {
      await this.hydrate();
    }
    return { dataType: this.dataType, data: this.values! };
  }
}

export class ChunkedJSON<Ret extends RetrievedData | Sparse>
  extends Deferrable
  implements FeatureData
{
  retrieve: (
    name?: string | number
  ) => Promise<{ dataType: 'quantitative' | 'categorical'; data: RetrievedData } | undefined>;
  ptr?: number[];
  names?: Record<string, number> | null;
  featNames: string[] = [];
  length?: number;

  url: Url;
  readonly dataType: DataType;
  readonly name: string;

  headerUrl?: Url;
  header?: ChunkedJSONHeader;
  activeDefault?: string;
  sparseMode?: SparseMode;
  allData?: ArrayBuffer;

  constructor({ name, url, headerUrl, header, dataType }: ChunkedJSONParams, autoHydrate = false) {
    super();
    this.name = name;
    this.url = url;
    this.header = header;
    this.headerUrl = headerUrl;
    this.dataType = dataType;

    if (!this.header && !this.headerUrl) throw new Error('Must provide header or headerUrl');
    if (autoHydrate) {
      throw new Error('Not implemented');
    }

    let densify: (
      obj: Sparse | null
    ) =>
      | ReturnType<ReturnType<typeof densifyToArray>>
      | ReturnType<ReturnType<typeof densifyToRecords>>;

    this.retrieve = genLRU(async (name: string | number) => {
      if (!browser) return;
      if (name === -1) throw new Error('-1 sent to retrieve');
      await this.hydrate();

      if (!densify) {
        switch (this.sparseMode) {
          case 'record':
            densify = densifyToRecords(Object.keys(this.names!));
            break;
          case 'array':
            densify = densifyToArray(this.length!); // After hydrated, this is guaranteed to be set.
            break;
        }
      }

      let idx: number;
      if (typeof name === 'string') {
        if (!this.names) throw new Error('Index must be number for ChunkedJSON without names.');
        idx = this.names[name];
      } else {
        if (this.names) {
          idx = this.names[name];
        } else {
          idx = name;
        }
      }
      if (idx === undefined) {
        console.error("Couldn't find index for", name);
        return undefined;
      }

      if (this.ptr![idx] === this.ptr![idx + 1]) {
        return densify ? { dataType: this.dataType, data: densify(null) } : undefined;
      }

      const raw = await fetch(this.url.url, {
        headers: {
          Range: `bytes=${this.ptr![idx]}-${this.ptr![idx + 1] - 1}`
        }
      });
      const blob = await raw.blob();
      const decomped = await ChunkedJSON.decompressBlob(blob);
      const ret = JSON.parse(decomped) as Ret;

      const data = densify ? densify(ret as Sparse) : ret;
      return { dataType: this.dataType, data };
    });
  }

  get revNames(): Record<number, string> | undefined {
    if (!this.names) return undefined;
    const f = oneLRU(() => {
      const out = {} as Record<number, string>;
      for (const [k, v] of Object.entries(this.names!)) {
        out[v] = k;
      }
      return out;
    });
    return f();
  }

  async hydrate(handle?: FileSystemDirectoryHandle) {
    if (this.hydrated) return this;
    if (!this.header && this.headerUrl) {
      if (handle) {
        this.headerUrl = await convertLocalToNetwork(handle, this.headerUrl);
        this.url = await convertLocalToNetwork(handle, this.url);
      }

      this.header = await fetch(this.headerUrl.url).then(
        (res) => res.json() as Promise<ChunkedJSONHeader>
      );
    }
    ({
      names: this.names,
      ptr: this.ptr,
      length: this.length,
      activeDefault: this.activeDefault,
      sparseMode: this.sparseMode
    } = this.header!);

    this.featNames = Object.keys(this.names!);
    if (!this.activeDefault && this.names) {
      this.activeDefault = Object.keys(this.names)[0];
    }

    this.hydrated = true;
    return this;
  }

  static decompressBlob =
    browser && 'CompressionStream' in window // Chromium
      ? async (blob: Blob) => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
            const ds = new DecompressionStream('gzip');
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
            const decompressedStream = blob.stream().pipeThrough(ds);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            return await new Response(decompressedStream).text();
          } catch (e) {
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            throw new Error(`Error decompressing blob: ${e}`);
          }
        }
      : async (blob: Blob): Promise<string> => {
          return pako.inflate((await blob.arrayBuffer()) as pako.Data, { to: 'string' });
        };
}

export function densifyToArray(length: number) {
  const zero = new Array(length).fill(0) as number[];
  return (obj: Sparse | null) => {
    if (!obj) return zero;
    console.assert(obj.index.length === obj.value.length);
    const dense = new Array(length).fill(0) as number[];
    for (let i = 0; i < obj.index.length; i++) {
      dense[obj.index[i]] = obj.value[i];
    }
    console.assert(dense.every((x) => x !== undefined));
    return dense;
  };
}

export function densifyToRecords(names: string[]) {
  return (obj: Sparse | null) => {
    if (!obj) return {};
    console.assert(obj.index.length === obj.value.length);
    const out = {} as Record<string, string | number>;
    for (let i = 0; i < obj.index.length; i++) {
      out[names[obj.index[i]]] = obj.value[i];
    }
    return out;
  };
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
