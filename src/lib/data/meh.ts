import { browser, dev } from '$app/env';
import { Sample, type SampleParams } from '$src/lib/data/sample';
import { ChunkedJSON, PlainJSON } from './dataHandlers';

export const names = ['Br6432_Ant_IF', 'Br6522_Ant_IF', 'Br8667_Post_IF'];
export const s3_url = dev
  ? ''
  : 'https://chaichontat-host.s3.us-west-004.backblazeb2.com/loopy-browser';

async function getSample(s: string) {
  const r = await fetch(`${s3_url}/${s}/sample.json`)
    .then((r) => r.json() as Promise<SampleParams>)
    .then(convertSamplePreload);
  return new Sample(r);
}

async function gen_samples(n: string[]) {
  return await Promise.all(n.map((s) => getSample(s)));
}

export default browser ? gen_samples(names) : undefined;

export function convertSamplePreload(r: SampleParams) {
  if (r.imgParams.headerUrl) {
    r.imgParams.headerUrl = {
      url: `${s3_url}/${r.name}/${r.imgParams.headerUrl.url}`,
      type: 'network'
    };
  }
  for (const url of r.imgParams.urls) {
    url.url = `${s3_url}/${r.name}/${url.url}`;
    url.type = 'network';
  }

  for (const f of r.featParams) {
    if (f.url) {
      f.url = { url: `${s3_url}/${r.name}/${f.url.url}`, type: 'network' };
    }
    if ('headerUrl' in f && f.headerUrl) {
      f.headerUrl = { url: `${s3_url}/${r.name}/${f.headerUrl.url}`, type: 'network' };
    }
  }
  return r;
}
