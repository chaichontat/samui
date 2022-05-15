import { browser, dev } from '$app/env';
import { Sample, type SampleParams } from '$src/lib/data/sample';

export const names = ['Br2720_Ant_IF', 'Br6432_Ant_IF', 'Br6522_Ant_IF', 'Br8667_Post_IF'];
export const s3_url = dev
  ? ''
  : 'https://chaichontat-host.s3.us-west-004.backblazeb2.com/loopy-browser';

async function gen_samples(n: string[]) {
  return await Promise.all(n.map((u) => getSample(`${s3_url}/${u}`)));
}

export default browser ? gen_samples(names) : undefined;

export async function getSample(s: string) {
  const r = await fetch(`${s}/sample.json`)
    .then((r) => r.json() as Promise<SampleParams>)
    .then((r) => convertSamplePreload(r, s));
  return new Sample(r);
}

export function convertSamplePreload(r: SampleParams, dirUrl: string) {
  for (const url of r.imgParams.urls) {
    url.url = `${dirUrl}/${url.url}`;
    url.type = 'network';
  }

  for (const f of r.featParams) {
    if (f.url) {
      f.url = { url: `${dirUrl}/${f.url.url}`, type: 'network' };
    }
    if ('headerUrl' in f && f.headerUrl) {
      f.headerUrl = { url: `${dirUrl}/${f.headerUrl.url}`, type: 'network' };
    }
  }

  for (const o of r.overlayParams) {
    if (o.url) {
      o.url = { url: `${dirUrl}/${o.url.url}`, type: 'network' };
    }
  }
  return r;
}
