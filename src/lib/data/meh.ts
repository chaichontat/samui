import { browser, dev } from '$app/environment';
import { getSample } from './preload';

export const names = ['Br2720_Ant_IF', 'Br6432_Ant_IF', 'Br6522_Ant_IF', 'Br8667_Post_IF'];
export const s3_url = dev ? '' : 'https://data.loopybrowser.com/VisiumIF';

async function gen_samples(n: string[]) {
  return await Promise.all(n.map((u) => getSample(`${s3_url}/${u}`)));
}

export default browser ? gen_samples(names) : undefined;
