import pako from 'pako';
import { genLRU } from '../utils';

export interface Data {
  retrieve: ((name: string) => Promise<number[] | undefined> | number[] | undefined) | undefined;
  hydrate: () => Promise<this>;
}

export class PlainJSON implements Data {
  kv = {} as Record<string, number[]> | undefined;
  constructor(readonly url: string, autoHydrate = true) {
    this.url = url;
    if (autoHydrate) {
      this.hydrate().catch(console.error);
    }
  }

  async hydrate() {
    await fetch(this.url).then((r) => r.json());
    return this;
  }

  retrieve(name: string): number[] | undefined {
    return this.kv ? this.kv[name] : undefined;
  }
}

type ChunkedJSONHeader = {
  n_spot: number;
  names: Record<string, number>;
  ptr: number[];
};

export type Sparse = { index: number[]; value: number[] };

export class ChunkedJSON implements Data {
  retrieve: ((name: string) => Promise<number[] | undefined>) | undefined;
  ptr: number[] | undefined;
  names: Record<string, number> | undefined;
  n_spot: number | undefined;

  constructor(
    private readonly headerUrl: string,
    private readonly url: string,
    autoHydrate = true
  ) {
    this.headerUrl = headerUrl;
    this.url = url;

    if (autoHydrate) {
      this.hydrate().catch(console.error);
    }
  }

  async hydrate() {
    const header = await fetch(this.headerUrl).then(
      (res) => res.json() as Promise<ChunkedJSONHeader>
    );
    ({ names: this.names, ptr: this.ptr, n_spot: this.n_spot } = header);

    let zero: number[] | undefined;
    this.retrieve = genLRU(async (selected: string): Promise<number[] | undefined> => {
      if (!zero) zero = new Array(this.n_spot).fill(0);

      if (this.ptr![this.names![selected]] === this.ptr![this.names![selected] + 1]) {
        return zero;
      }

      return await fetch(this.url, {
        headers: {
          Range: `bytes=${this.ptr![this.names![selected]]}-${
            this.ptr![this.names![selected] + 1] - 1
          }`
        }
      })
        .then((res) => res.blob())
        .then((blob) => this.decompressBlob(blob))
        .then((arr) => JSON.parse(arr) as Sparse)
        .then((sparse) => this.genDense(sparse, this.n_spot!));
    });

    return this;
  }

  decompressBlob = false // browser && 'CompressionStream' in window // Chromium
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

  genDense(obj: Sparse, len: number): number[] {
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

//   constructor(private readonly url: string, autoHydrate = true) {
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
