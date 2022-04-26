import { browser } from '$app/env';
import pako from 'pako';
import { Deferrable, genLRU, getFile } from '../utils';

export interface Data {
  // retrieve: ((name: string | number) => Promise<number[] | undefined | Sparse>) | undefined;
  hydrate: (handle?: FileSystemDirectoryHandle) => Promise<this>;
  hydrated: boolean;
}
export type Url = { url: string; type: 'local' | 'network' };
export type DataType = 'categorical' | 'quantitative' | 'coords';

export type PlainJSONParams = {
  type: 'plainJSON';
  name: string;
  dataType?: DataType;
  url?: Url;
  values?: unknown;
};

export type ChunkedJSONParams = {
  type: 'chunkedJSON';
  name: string;
  url: Url;
  dataType?: DataType;
  headerUrl?: Url;
  header?: ChunkedJSONHeader;
  options?: ChunkedJSONOptions;
};

export type ChunkedJSONOptions = {
  densify?: boolean;
};

export type ChunkedJSONHeader = {
  length: number;
  names: Record<string, number> | null;
  ptr: number[];
};
export type FeatureParams = ChunkedJSONParams | PlainJSONParams;
export type Sparse = { index: number[]; value: number[] };

export class PlainJSON extends Deferrable implements Data {
  name: string;
  url?: Url;
  dataType?: DataType;
  values?: unknown;
  hydrated = false;

  constructor({ name, url, dataType, values }: PlainJSONParams, autoHydrate = false) {
    super();
    this.name = name;
    this.url = url;
    this.values = values;
    this.dataType = dataType ?? 'quantitative';

    if (!this.url && !this.values) throw new Error('Must provide url or value');
    if (autoHydrate) {
      this.hydrate().catch(console.error);
    }
  }

  async hydrate(handle?: FileSystemDirectoryHandle) {
    if (!this.values && this.url) {
      if (handle) {
        this.url = await convertLocalToNetwork(handle, this.url);
      }
      this.values = (await fetch(this.url.url).then((r) => r.json())) as unknown;
    }
    this.hydrated = true;
    return this;
  }

  retrieve(name: string | number) {
    return this.values[name];
  }
}

export class ChunkedJSON implements Data {
  retrieve: ((name: string | number) => Promise<number[] | undefined | Sparse>) | undefined;
  ptr?: number[];
  names?: Record<string, number> | null;
  length?: number;

  dataType: DataType;
  headerUrl?: Url;
  header?: ChunkedJSONHeader;
  url: Url;
  name: string;
  hydrated = false;

  allData?: ArrayBuffer;

  readonly densify: boolean;

  constructor(
    { name, url, headerUrl, header, dataType, options }: ChunkedJSONParams,
    autoHydrate = false
  ) {
    this.name = name;
    this.url = url;
    this.header = header;
    this.dataType = dataType ?? 'quantitative';
    this.headerUrl = headerUrl;
    this.densify = options?.densify ?? true;

    if (!this.header && !this.headerUrl) throw new Error('Must provide header or headerUrl');
    if (autoHydrate) {
      throw new Error('Not implemented');
      // this.hydrate(handle).catch(console.error);
    }
  }

  get revNames(): Record<number, string> | undefined {
    if (!this.names) return undefined;
    const f = genLRU(() => {
      const out = {} as Record<number, string>;
      for (const [k, v] of Object.entries(this.names!)) {
        out[v] = k;
      }
      return out;
    });
    return f();
  }

  async hydrate(handle?: FileSystemDirectoryHandle) {
    if (!this.header && this.headerUrl) {
      if (handle) {
        this.headerUrl = await convertLocalToNetwork(handle, this.headerUrl);
        this.url = await convertLocalToNetwork(handle, this.url);
      }

      this.header = await fetch(this.headerUrl.url).then(
        (res) => res.json() as Promise<ChunkedJSONHeader>
      );
    }
    ({ names: this.names, ptr: this.ptr, length: this.length } = this.header!);

    const zero = new Array(this.length).fill(0) as number[];

    this.retrieve = genLRU(
      async (selected: string | number): Promise<number[] | Sparse | undefined> => {
        if (!browser) return;
        if (selected === -1) throw new Error('-1 sent to retrieve');

        let idx: number;
        if (typeof selected === 'string') {
          if (!this.names) throw new Error('Index must be number for ChunkedJSON without names.');
          idx = this.names[selected];
        } else {
          if (this.names) {
            idx = this.names[selected];
          } else {
            idx = selected;
          }
        }

        if (this.ptr![idx] === this.ptr![idx + 1]) {
          return zero;
        }

        const raw = await fetch(this.url.url, {
          headers: {
            Range: `bytes=${this.ptr![idx]}-${this.ptr![idx + 1] - 1}`
          }
        });
        const blob = await raw.blob();
        const decomped = await this.decompressBlob(blob);
        const sparse = JSON.parse(decomped) as Sparse;
        return this.densify ? this.genDense(sparse) : sparse;
      }
    );
    this.hydrated = true;
    return this;
  }

  decompressBlob =
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
            throw new Error(`Error decompressing blob: ${e}`);
          }
        }
      : async (blob: Blob): Promise<string> => {
          return pako.inflate((await blob.arrayBuffer()) as pako.Data, { to: 'string' });
        };

  genDense(obj: Sparse): number[] {
    console.assert(obj.index.length === obj.value.length);
    const dense = new Array(obj.index.length).fill(0) as number[];
    for (let i = 0; i < obj.index.length; i++) {
      dense[obj.index[i]] = obj.value[i];
    }
    console.assert(dense.every((x) => x !== undefined));
    return dense;
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
