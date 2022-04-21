import { browser } from '$app/env';
import pako from 'pako';
import { genLRU } from '../utils';

export interface Data {
  retrieve: ((name: string | number) => Promise<number[] | undefined | Sparse>) | undefined;
  hydrate: () => Promise<this>;
}

export type PlainJSONParams = {
  type: 'plainJSON';
  name: string;
  dataType?: 'categorical' | 'quantitative';
  url?: string;
  values?: unknown;
};

export type ChunkedJSONParams = {
  type: 'chunkedJSON';
  name: string;
  url: string;
  dataType?: 'categorical' | 'quantitative';
  headerUrl?: string;
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

export class PlainJSON implements Data {
  name: string;
  url?: string;
  dataType?: 'categorical' | 'quantitative';
  values?: unknown;

  constructor({ name, url, dataType, values }: PlainJSONParams, autoHydrate = false) {
    this.name = name;
    this.url = url;
    this.values = values;
    this.dataType = dataType ?? 'quantitative';

    if (!this.url && !this.values) throw new Error('Must provide url or value');
    if (autoHydrate) {
      this.hydrate().catch(console.error);
    }
  }

  async hydrate() {
    if (!this.values && this.url) {
      this.values = (await fetch(this.url).then((r) => r.json())) as unknown;
    }
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

  dataType: 'categorical' | 'quantitative';
  headerUrl?: string;
  header?: ChunkedJSONHeader;
  url: string;
  name: string;

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
      this.hydrate().catch(console.error);
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

  async hydrate() {
    if (!this.header && this.headerUrl) {
      this.header = await fetch(this.headerUrl).then(
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

        const raw = await fetch(this.url, {
          headers: {
            Range: `bytes=${this.ptr![idx]}-${this.ptr![idx + 1] - 1}`
          }
        });
        const blob = await raw.blob();
        const decomped = await this.decompressBlob(blob);
        const sparse = JSON.parse(decomped) as Sparse;
        return this.genDense(sparse, this.length!, this.densify);
      }
    );

    return this;
  }

  decompressBlob =
    browser && 'CompressionStream' in window // Chromium
      ? async (blob: Blob) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
          const ds = new DecompressionStream('gzip');
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
          const decompressedStream = blob.stream().pipeThrough(ds);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          return await new Response(decompressedStream).text();
        }
      : async (blob: Blob): Promise<string> => {
          return pako.inflate((await blob.arrayBuffer()) as pako.Data, { to: 'string' });
        };

  genDense(obj: Sparse, len: number, densify: false): Sparse;
  genDense(obj: Sparse, len: number, densify: true): number[];
  genDense(obj: Sparse, len: number, densify: boolean): number[] | Sparse;
  genDense(obj: Sparse, len: number, densify: boolean): number[] | Sparse {
    if (!densify) return obj;
    const dense = new Array(len).fill(0) as number[];
    for (let i = 0; i < obj.index.length; i++) {
      dense[obj.index[i]] = obj.value[i];
    }
    return dense;
  }
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
