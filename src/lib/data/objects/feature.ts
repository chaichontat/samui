import { keyLRU } from '$src/lib/lru';

export type FeatureType = 'categorical' | 'quantitative' | 'singular';
export type CSVRetrievedData = Record<string, number | string>[];

// If ChunkedJSON, feature and name.
// If PlainJSON, only name.
export type FeatureAndGroup = {
  readonly group: string;
  readonly feature: string;
};

export interface RetrievedData {
  dataType: FeatureType;
  data: CSVRetrievedData;
  coordName?: string;
  mPerPx?: number;
  size?: number;
  unit?: string;
}

export interface FeatureParams {
  type: string;
  name: string;
  dataType: FeatureType;
}

export interface FeatureData {
  hydrate(handle?: FileSystemDirectoryHandle): Promise<this>;
  retrieve(name?: string): Promise<RetrievedData | undefined>;
}

// TODO Set spec.
export const convertCategoricalToNumber = keyLRU((arr: (number | string)[]) => {
  const unique = [...new Set(arr)];
  const legend = {} as Record<number | string, number>;
  const legendArr = [] as (number | string)[];
  for (const [i, v] of unique.sort().entries()) {
    legend[v] = i;
    legendArr.push(v);
  }
  // TODO: Overwrite old thing?
  const converted = arr.map((v) => legend[v]);
  return { legend: legendArr, converted };
});

export const stats = keyLRU((arr: (number | string)[]) => {
  const minmax = [0, 0];
  if (typeof arr[0] === 'number') {
    for (const n of arr) {
      minmax[0] = Math.min(minmax[0], n as number);
      minmax[1] = Math.max(minmax[1], n as number);
    }
    return minmax;
  }
  return undefined;
});
