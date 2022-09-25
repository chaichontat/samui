import { browser, dev } from '$app/environment';
import { samples } from '../store';
import { Sample, type SampleParams } from './objects/sample';

const s3_url = dev ? '' : 'https://data.loopybrowser.com/VisiumIF';
// export const names = ['Br2720_Ant_IF', 'Br6432_Ant_IF', 'Br6522_Ant_IF', 'Br8667_Post_IF'];
const names = ['Br2720_Ant_IF', 'Br6432_Ant_IF', 'Br6522_Ant_IF', 'Br8667_Post_IF'];

export default browser
  ? async () => {
      const out = {} as Record<string, Sample>;
      (await getSamples(names)).forEach((s) => (out[s.name] = s));
      samples.set(out);
    }
  : () => {};

async function getSample(s: string) {
  const params = await fetch(`${s}/sample.json`).then((r) => r.json() as Promise<SampleParams>);
  const converted = convertSamplePreload(params, s);
  return new Sample(converted);
}

async function getSamples(n: string[]) {
  return await Promise.all(n.map((u) => getSample(`${s3_url}/${u}`)));
}

function convertSamplePreload(r: Partial<SampleParams>, dirUrl: string) {
  if (r.imgParams) {
    for (const url of r.imgParams.urls) {
      url.url = `${dirUrl}/${url.url}`;
      url.type = 'network';
    }
  }

  if (r.coordParams) {
    for (const o of r.coordParams) {
      if (o.url) {
        o.url = { url: `${dirUrl}/${o.url.url}`, type: 'network' };
      }
    }
  }

  if (r.featParams) {
    for (const f of r.featParams) {
      if (f.url) {
        f.url = { url: `${dirUrl}/${f.url.url}`, type: 'network' };
      }
      if ('headerUrl' in f && f.headerUrl) {
        f.headerUrl = { url: `${dirUrl}/${f.headerUrl.url}`, type: 'network' };
      }
    }
  }

  return r as SampleParams;
}
