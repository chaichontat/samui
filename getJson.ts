import * as fs from 'fs/promises';
import fetch from 'node-fetch';
import * as path from 'path';

const dir = 'static';
const samples = ['Br2720_Ant_IF', 'Br6432_Ant_IF', 'Br6522_Ant_IF', 'Br8667_Post_IF'];

const s3_url = 'https://libd-spatial-dlpfc-loopy.s3.amazonaws.com/VisiumIF';

async function getFiles(p: string, urls: string[]): Promise<Promise<void>[]> {
  await fs.mkdir(p, { recursive: true });
  return urls.map(async (url) => {
    const pa = path.join(p, url.split('/').pop()!);
    try {
      await fs.access(pa);
    } catch (e) {
      console.log(`Downloading ${url} to ${pa}.`);
      await fetch(url)
        .then((r) => r.arrayBuffer())
        .then((r) => fs.writeFile(pa, Buffer.from(r)));
    }
  });
}

const toGet = [
  'gene_csc.json',
  'sample.json',
  'cluster_graph.csv',
  'cellCoords.csv',
  'cellType.csv',
  'cellsFiltered.csv',
  'cellsUnfiltered.csv',
  'spotCoords.csv',
  'kmeans.csv',
  'sample.json',
  'metadata.md'
];

async function run() {
  const ps: Promise<unknown>[] = samples.flatMap(async (s) => {
    return await getFiles(
      path.join(dir, s),
      toGet.map((name) => `${s3_url}/${s}/${name}`)
    );
  });

  await Promise.all(ps);
}

await run();
