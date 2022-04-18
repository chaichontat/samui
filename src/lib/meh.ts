import { browser, dev } from '$app/env';
import { activeSample, done, samples } from '$lib/store';
import { Sample } from '$src/lib/data/sample';
import { get } from 'svelte/store';

export const names = ['Br2720_Ant_IF', 'Br6432_Ant_IF', 'Br6522_Ant_IF', 'Br8667_Post_IF'];
export const s3_url = dev ? '' : 'https://f004.backblazeb2.com/file/chaichontat-host/loopy-browser';

function gen_samples(n: string[]): Promise<Sample>[] {
  const out = [];
  const s = '151508';
  out.push(
    new Sample(s, { headerUrl: `/${s}/image.json`, urls: [`${s3_url}/${s}/${s}.tif`] }, [
      {
        name: 'genes',
        type: 'chunkedJSON',
        headerUrl: `${s}/gene_csc.json`,
        url: `${s3_url}/${s}/gene_csc.bin`
      },
      {
        name: 'spotGenes',
        type: 'chunkedJSON',
        headerUrl: `${s}/gene_csr.json`,
        url: `${s3_url}/${s}/gene_csr.bin`,
        options: { densify: false }
      }
    ])
      .hydrate()
      .then((s) => {
        activeSample.set(s.name);
        samples.set({ [s.name]: s, ...get(samples) });
        return s;
      })
  );

  for (const [i, s] of n.entries()) {
    const sam = new Sample(
      s,
      {
        headerUrl: `/${s}/image.json`,
        urls: [`${s3_url}/${s}/${s}_1.tif`, `${s3_url}/${s}/${s}_2.tif`]
      },
      [
        {
          name: 'genes',
          type: 'chunkedJSON',
          headerUrl: `/${s}/gene_csc.json`,
          url: `${s3_url}/${s}/gene_csc.bin`
        },
        {
          name: 'spotGenes',
          type: 'chunkedJSON',
          headerUrl: `/${s}/gene_csr.json`,
          url: `${s3_url}/${s}/gene_csr.bin`,
          options: { densify: false }
        },
        {
          name: 'umap',
          type: 'plainJSON',
          url: `/${s}/umap.json`
        }
      ]
    )
      .hydrate()
      .then((s) => {
        samples.set({ [s.name]: s, ...get(samples) });
        if (i === n.length - 1) done.set(true);
        return s;
      });
    out.push(sam);
  }

  return out;
}

export default browser ? gen_samples(names) : undefined;
