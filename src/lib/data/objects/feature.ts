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
export const convertCategoricalToNumber = keyLRU((values: Record<string, number | string>[]) => {
  const key = Object.keys(values[0]).length === 1 ? Object.keys(values[0])[0] : 'value';
  if (!(key in values[0])) {
    throw new Error('value not found in CSV for ChunkedCSV with coord in feature.');
  }

  const arr = values.map((v) => v[key]);

  const unique = [...new Set(arr)];
  const legend = {} as Record<number | string, number>;
  const legendArr = [] as (number | string)[];
  for (const [i, v] of unique.sort().entries()) {
    legend[v] = i;
    legendArr.push(v);
  }
  // TODO: Overwrite old thing?
  const converted = values.map((v) => ({ ...v, [key]: legend[v[key]] }));
  return { legend: legendArr, converted };
});
