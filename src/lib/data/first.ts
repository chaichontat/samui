import { dev } from '$app/env';
import sp from './default/sample.json';
import { convertSamplePreload } from './meh';
import { Sample, type SampleParams } from './sample';

export const s3_url = dev
  ? ''
  : 'https://chaichontat-host.s3.us-west-004.backblazeb2.com/loopy-browser';

const sampleparams = { ...sp } as SampleParams;
const sample = new Sample(convertSamplePreload(sampleparams), true);
export default sample;
