import { Sample, type SampleParams } from './sample';

export function getSampleList(winlocsearch: string) {
  const params = new URLSearchParams(winlocsearch);
  const url = params.get('url');
  const s = params.getAll('s');
  return s.map((ss) => `https://${url ?? ''}${ss}`);
}

export async function getSample(s: string) {
  return await fetch(`${s}/sample.json`)
    .then((r) => r.json() as Promise<SampleParams>)
    .then((r) => convertSamplePreload(r, s))
    .then((r) => new Sample(r));
}

function convertSamplePreload(r: Partial<SampleParams>, dirUrl: string) {
  if (!r.imgParams) throw new Error(`No imgParams in ${r.name!}`);
  for (const url of r.imgParams.urls) {
    url.url = `${dirUrl}/${url.url}`;
    url.type = 'network';
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
