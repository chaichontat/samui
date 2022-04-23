import { browser, dev } from '$app/env';
import { Sample } from '$src/lib/data/sample';

export const names = ['Br6432_Ant_IF', 'Br6522_Ant_IF', 'Br8667_Post_IF'];
export const s3_url = dev
  ? ''
  : 'https://chaichontat-host.s3.us-west-004.backblazeb2.com/loopy-browser';

function gen_samples(n: string[]): Sample[] {
  const out = [];
  for (const s of n) {
    // const kmeans: FeatureParams[] = [...Array(8).keys()].map((i) => ({
    //   name: `kmeans${i + 2}`,
    //   type: 'plainJSON',
    //   url: { url: `/${s}/kmeans${i + 2}.json`, type: 'network' }
    // }));

    const sam = new Sample({
      name: s,
      imgParams: {
        headerUrl: { url: `/${s}/image.json`, type: 'network' },
        urls: [`${s3_url}/${s}/${s}_1.tif`, `${s3_url}/${s}/${s}_2.tif`].map((url) => ({
          url,
          type: 'network'
        }))
      },
      featParams: [
        {
          name: 'genes',
          type: 'chunkedJSON',
          headerUrl: { url: `/${s}/gene_csc.json`, type: 'network' },
          url: { url: `${s3_url}/${s}/gene_csc.bin`, type: 'network' }
        },
        {
          name: 'spotGenes',
          type: 'chunkedJSON',
          headerUrl: { url: `/${s}/gene_csr.json`, type: 'network' },
          url: { url: `${s3_url}/${s}/gene_csr.bin`, type: 'network' },
          options: { densify: false }
        },
        {
          name: 'umap',
          type: 'plainJSON',
          url: { url: `/${s}/umap.json`, type: 'network' }
        }
        // {
        //   name: 'tsne',
        //   type: 'plainJSON',
        //   url: { url: `/${s}/tsne.json`, type: 'network' }
        // }
      ]
    });
    out.push(sam);
  }
  return out;
}

export default browser ? gen_samples(names) : undefined;
