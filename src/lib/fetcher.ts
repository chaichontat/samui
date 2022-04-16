// Globs do not accept variable. Pass in real string.

// Need rest index signature
// https://github.com/microsoft/TypeScript/issues/17867
// https://github.com/microsoft/TypeScript/issues/7765

// export function getData<T extends string>(dir: string) {
//   const jsons: Record<string, { default: number[] }> = import.meta.globEager(
//     path.join(dir, '*.json')
//   );
//   const data = Object.keys(jsons).reduce((acc, k) => {
//     const name = k.split('/').pop()!.split('.')[0];
//     if (name === 'coords' || name === 'by_row') return acc;
//     return { ...acc, [name]: jsons[k].default };
//   }, {} as Record<T, number[]>);

//   const { coords, by_row } = {
//     coords: import.meta.globEager(path.join(dir, 'coords.json')).default as {
//       x: number;
//       y: number;
//     }[],
//     by_row: import.meta.globEager(path.join(dir, 'by_row.json')).default as Record<T, number>[]
//   };

//   return { data, coords, byRow: by_row };
// }
import { browser } from '$app/env';
import { tableFromIPC } from 'apache-arrow';
import pako from 'pako';
import { genLRU } from './utils';

export async function fetchArrow<T>(sample: string, name: string) {
  const table = await fetch(`/${sample}/${name}.arrow`).then((r) => tableFromIPC(r));
  const coords = table.toArray().map((row) => row!.toJSON()) as unknown as T;
  return coords;
}

export async function fetchAll(sample: string) {
  const [table, coordsTable] = await Promise.all(
    [`/${sample}/data.arrow`, `/${sample}/coords.arrow`].map(async (url) =>
      fetch(url).then((r) => tableFromIPC(r))
    )
  );

  const data = {} as Record<string, Float32Array>;
  for (const name of table.schema.names) {
    data[name as string] = table.getChild(name)!.toArray() as Float32Array;
  }

  const coords = coordsTable.toArray().map((row) => row!.toJSON()) as { x: number; y: number }[];

  return { data, coords };
}

export function dataProcess<T extends string>(data: Record<T, number[]>) {
  const idxs = {} as Record<T, number>;
  const maxs: number[] = [];
  const cellTypes: T[] = [];

  for (const [i, k] of Object.keys(data).entries()) {
    idxs[k as T] = i;
    cellTypes.push(k as T);
    maxs.push(Math.max(...data[k as T]));
  }
  return { idxs, maxs, cellTypes };
}

// Compressed Columns
export function genRetrieve(ptr: number[], names: { [key: string]: number }, len: number) {
  const zero = Array(len).fill(0) as number[];

  return genLRU(async (selected: string): Promise<number[]> => {
    if (ptr[names[selected]] === ptr[names[selected] + 1]) {
      return zero;
    }
    // console.log(`bytes=${ptr[names[selected]]}-${ptr[names[selected] + 1] - 1}`);
    return await fetch(
      'https://chaichontat-host.s3.amazonaws.com/libd-rotation/Br6522_Ant_IF/Counts_Br6522_Ant_IF.dump',
      { headers: { Range: `bytes=${ptr[names[selected]]}-${ptr[names[selected] + 1] - 1}` } }
    )
      .then((res) => res.blob())
      .then((blob) => decompressBlob(blob))
      .then((arr) => JSON.parse(arr) as Sparse)
      .then((sparse) => genDense(sparse, len));
  });
}

export type Sparse = { index: number[]; value: number[] };

export const decompressBlob =
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

export function genDense(obj: Sparse, len: number): number[] {
  const dense = new Array(len).fill(0) as number[];
  for (let i = 0; i < obj.index.length; i++) {
    dense[obj.index[i]] = obj.value[i];
  }
  return dense;
}

export default fetchAll;
