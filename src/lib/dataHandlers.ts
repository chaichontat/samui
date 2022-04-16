import { browser } from '$app/env';
import { tableFromIPC } from 'apache-arrow';
import type { TypedArray } from 'apache-arrow/interfaces';
import { genLRU } from './utils';

export type SpotParams = {
  coords: { x: number; y: number }[];
  params: { spotDiam: number; mPerPx: number };
};

export type Sparse = { index: number[]; value: number[] };

export interface Data {
  retrieve: ((name: string) => Promise<number[]> | number[] | TypedArray) | undefined;
}

export class ChunkedJSON implements Data {
  retrieve: ((name: string) => Promise<number[]>) | undefined;
  private ptr: number[] | undefined;
  private names: Record<string, number> | undefined;

  constructor(
    private readonly headerFolder: string,
    private readonly url: string,
    readonly len: number
  ) {
    this.headerFolder = headerFolder;
    this.url = url;
    this.len = len;

    // this.getPtr()
    //   .then(() => (this.retrieve = this.genRetrieve(this.ptr!, this.names!, this.len)))
    //   .catch(console.error);
  }

  async hydrate() {
    [this.names, this.ptr] = await Promise.all([
      fetch(`${this.headerFolder}/names.json`).then(
        (x) => x.json() as Promise<{ [key: string]: number }>
      ),
      fetch(`${this.headerFolder}/ptr.json`).then((res) => res.json() as Promise<number[]>)
    ]);
  }

  genRetrieve(ptr: number[], names: { [key: string]: number }, len: number) {
    const zero = Array(len).fill(0) as number[];

    return genLRU(async (selected: string): Promise<number[]> => {
      if (ptr[names[selected]] === ptr[names[selected] + 1]) {
        return zero;
      }
      return await fetch(this.url, {
        headers: { Range: `bytes=${ptr[names[selected]]}-${ptr[names[selected] + 1] - 1}` }
      })
        .then((res) => res.blob())
        .then((blob) => this.decompressBlob(blob))
        .then((arr) => JSON.parse(arr) as Sparse)
        .then((sparse) => this.genDense(sparse, len));
    });
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
          //@ts-ignore
          return pako.inflate(await blob.arrayBuffer(), { to: 'string' });
        };

  genDense(obj: Sparse, len: number): number[] {
    const dense = new Array(len).fill(0) as number[];
    for (let i = 0; i < obj.index.length; i++) {
      dense[obj.index[i]] = obj.value[i];
    }
    return dense;
  }
}

export class Arrow {
  private readonly data: Record<string, TypedArray>;

  constructor(
    private readonly url: string,
    public readonly sample: string,
    public readonly keys: string[],
    autoFetch = true
  ) {
    this.sample = sample;
    this.keys = keys;
    this.url = url;
    this.data = {} as Record<string, TypedArray>;

    if (autoFetch) {
      this.hydrate().catch(console.error);
    }
  }

  retrieve(name: string): TypedArray {
    return this.data[name];
  }

  async hydrate() {
    const table = await fetch(this.url).then((r) => tableFromIPC(r));
    for (const name of table.schema.names) {
      this.data[name as string] = table.getChild(name)!.toArray() as Float32Array;
    }
  }
}

export class Images {
  coords: { x: number; y: number }[] | undefined;
  len: number | undefined;

  constructor(
    private readonly urls: string[],
    private readonly coordsUrl: string,
    private readonly params: SpotParams
  ) {
    this.urls = urls;
    this.coordsUrl = coordsUrl;
    this.params = params;
  }

  async hydrate() {
    const coordsTable = await fetch(this.coordsUrl).then((r) => tableFromIPC(r));
    this.coords = coordsTable.toArray().map((row) => row!.toJSON()) as { x: number; y: number }[];
    this.len = this.coords.length;
  }
}

export type Sample = {
  images: Images;
  features: Record<string, Arrow | ChunkedJSON>;
};
