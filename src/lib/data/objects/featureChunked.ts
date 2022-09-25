import { browser } from '$app/environment';
import { Deferrable } from '$src/lib/definitions';
import { convertLocalToNetwork, fromCSV, type Url } from '$src/lib/io';
import { genLRU, oneLRU } from '$src/lib/lru';
import pako from 'pako';
import type { CSVRetrievedData, FeatureData, FeatureParams, FeatureType } from './feature';

export type Sparse = { index: number; value: number }[];
type SparseMode = 'record' | 'array' | null;

export interface ChunkedCSVParams extends FeatureParams {
  name: string;
  type: 'chunkedCSV';
  url: Url;
  headerUrl?: Url;
  header?: ChunkedCSVHeader;
  dataType: 'categorical' | 'quantitative';
  unit?: string;
}

export type ChunkedCSVHeader = {
  length: number;
  names: string[] | null;
  ptr: number[];
  coordName?: string;
  mPerPx?: number;
  size?: number;
  activeDefault?: string;
  sparseMode?: SparseMode;
};

export class ChunkedCSV extends Deferrable implements FeatureData {
  retrieve: (name?: string | number) => Promise<
    | {
        dataType: 'quantitative' | 'categorical';
        data: CSVRetrievedData;
        coordName?: string;
        mPerPx?: number;
        size?: number;
      }
    | undefined
  >;
  ptr?: number[];
  names?: Record<string, number>;
  featNames: string[] = [];
  length?: number;
  unit?: string;

  url: Url;
  readonly dataType: FeatureType;
  readonly name: string;

  headerUrl?: Url;
  header?: ChunkedCSVHeader;
  activeDefault?: string;
  sparseMode?: SparseMode;
  allData?: ArrayBuffer;

  constructor(
    { name, url, headerUrl, header, dataType, unit }: ChunkedCSVParams,
    autoHydrate = false
  ) {
    super();
    this.name = name;
    this.url = url;
    this.header = header;
    this.headerUrl = headerUrl;
    this.dataType = dataType;
    this.unit = unit;

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
        if (!this.names) throw new Error('Index must be number for ChunkedCSV without names.');
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
        return densify
          ? { dataType: this.dataType, data: densify(null), coordName: this.header?.coordName }
          : undefined;
      }

      const raw = await fetch(this.url.url, {
        headers: {
          Range: `bytes=${this.ptr![idx]}-${this.ptr![idx + 1] - 1}`
        }
      });
      const blob = await raw.blob();
      const decomped = await ChunkedCSV.decompressBlob(blob);

      const ret = await fromCSV(decomped);
      if (!ret) {
        console.error('Failed to parse chunked CSV');
        return undefined;
      }

      const data = densify ? densify(ret.data) : ret.data;
      return {
        dataType: this.dataType,
        data,
        coordName: this.header?.coordName,
        mPerPx: this.header?.mPerPx,
        size: this.header?.size,
        unit: this.unit
      };
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
        (res) => res.json() as Promise<ChunkedCSVHeader>
      );
    }

    if (this.header) {
      this.featNames = this.header.names =
        this.header.names ?? [...Array(this.header.length).keys()].map((i) => i.toString());

      this.names = {};
      for (const [i, name] of this.featNames.entries()) {
        this.names[name] = i;
      }

      ({
        ptr: this.ptr,
        length: this.length,
        activeDefault: this.activeDefault,
        sparseMode: this.sparseMode
      } = this.header!);

      if (!this.activeDefault && this.names) {
        this.activeDefault = Object.keys(this.names)[0];
      }
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
    const dense = new Array(length).fill(0) as number[];
    for (const { index, value } of obj) {
      dense[index] = value;
    }
    return dense;
  };
}

export function densifyToRecords(names: string[]) {
  return (obj: Sparse | null) => {
    if (!obj) return {};
    const out = {} as Record<string, string | number>;
    for (const { index, value } of obj) {
      out[names[index]] = value;
    }
    return out;
  };
}
