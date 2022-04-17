import { browser } from '$app/env';
import { activeSample, done, samples } from '$lib/store';
import { Sample } from '$src/lib/data/sample';
import { get } from 'svelte/store';

export const names = ['Br2720_Ant_IF', 'Br6432_Ant_IF', 'Br6522_Ant_IF', 'Br8667_Post_IF'];

function gen_samples(n: string[]): Promise<Sample>[] {
  const out = [];
  for (const [i, s] of n.entries()) {
    const sam = new Sample(
      s,
      { headerUrl: `/${s}/image.json`, urls: [`/${s}/${s}_1.tif`, `/${s}/${s}_2.tif`] },
      [
        {
          name: 'genes',
          type: 'chunkedJSON',
          headerUrl: `${s}/gene_csc.json`,
          url: `/${s}/gene_csc.bin`
        },
        {
          name: 'spotGenes',
          type: 'chunkedJSON',
          headerUrl: `${s}/gene_csr.json`,
          url: `/${s}/gene_csr.bin`,
          options: { densify: false }
        }
      ]
    )
      .hydrate()
      .then((s) => {
        samples.set({ [s.name]: s, ...get(samples) });
        if (i === 0) activeSample.set(s.name);
        if (i === n.length - 1) done.set(true);
        return s;
      });
    out.push(sam);
  }
  return out;
}

export default browser ? gen_samples(names) : undefined;
