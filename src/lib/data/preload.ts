import { browser, dev } from '$app/environment';
import type { Url } from '../io';
import { isOnline, samples } from '../store';
import { handleError } from '../utils';
import { Sample, type SampleParams } from './objects/sample';

const s3_url = dev ? '' : 'https://libd-spatial-dlpfc-loopy.s3.amazonaws.com/VisiumIF';
// export const names = ['Br2720_Ant_IF', 'Br6432_Ant_IF', 'Br6522_Ant_IF', 'Br8667_Post_IF'];
const names = ['Br2720_Ant_IF', 'Br6432_Ant_IF', 'Br6522_Ant_IF', 'Br8667_Post_IF'];

export default browser
  ? async () => {
      const out = {} as Record<string, Sample>;
      (await getSamples(names)).forEach((s) => (out[s.name] = s));
      samples.set(out);
    }
  : () => {};

export async function getSample(s: string) {
  const params = await fetch(`${s}/sample.json`)
    .then((r) => r.json() as Promise<SampleParams>)
    .catch(() => handleError(new Error(`Could not get ${s}`)));

  if (!params) {
    throw new Error(`Could not get ${s}`);
  }

  const converted = convertSamplePreload(params, s);
  return new Sample(converted);
}

async function getSamples(n: string[]) {
  return await Promise.all(n.map((u) => getSample(`${s3_url}/${u}`)));
}

function subsNetwork(dirUrl: string): (url: Url) => Url {
  return (url: Url) =>
    url.type === 'network' ? url : { url: `${dirUrl}/${url.url}`, type: 'network' };
}

function convertSamplePreload(r: Partial<SampleParams>, dirUrl: string) {
  const sub = subsNetwork(dirUrl);
  isOnline.set(true);

  r.notesMd && (r.notesMd = sub(r.notesMd));
  r.metadataMd && (r.metadataMd = sub(r.metadataMd));
  r.imgParams && (r.imgParams.urls = r.imgParams.urls.map(sub));

  if (r.coordParams) {
    for (const o of r.coordParams) {
      if (o.url) {
        o.url = sub(o.url);
      }
    }
  }

  if (r.featParams) {
    for (const f of r.featParams) {
      if (f.url) {
        f.url = sub(f.url);
      }
      if ('headerUrl' in f && f.headerUrl) {
        f.headerUrl = sub(f.headerUrl);
      }
    }
  }

  return r as SampleParams;
}

// From URL
export function getSampleListFromQuery(winlocsearch: string) {
  const params = new URLSearchParams(winlocsearch);
  const url = params.get('url');
  const s = params.getAll('s');
  if (!s.length)
    handleError(
      new Error(
        `No samples provided in the URL.
Example format is https://loopybrowser.com/from?url=data2.loopybrowser.com/merfish/&s=BrainReceptorShowcase1
where s is the sample name.`.replace(/\n/g, ' ')
      )
    );
  return s.map((ss) => `https://${url ?? ''}${url?.endsWith('/') ? '' : '/'}${ss}`);
}
