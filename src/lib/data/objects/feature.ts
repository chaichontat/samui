import { keyLRU } from '$src/lib/lru';
import * as d3 from 'd3';

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
  console.debug("Converting categorical to number")
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
  if (typeof arr[0] !== 'number') {
    return [0, 1];
  }
  for (let i = 0; i < arr.length; i++) {
    arr[i] = Number(arr[i]) || 0; // Convert NaN to 0.
  }
  return d3.extent(arr as unknown as number[]);
});
