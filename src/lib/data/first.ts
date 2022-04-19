import { dev } from '$app/env';
import { get } from 'svelte/store';
import { activeSample, samples } from '../store';
import type { ChunkedJSONHeader, FeatureParams } from './dataHandlers';
import csc from './default/gene_csc.json';
import csr from './default/gene_csr.json';
import image from './default/image.json';
import type { ImageHeader, ImageParams } from './image';
import { Sample } from './sample';

const s = '151508';
export const s3_url = dev
  ? ''
  : 'https://chaichontat-host.s3.us-west-004.backblazeb2.com/loopy-browser';

const imgParams: ImageParams = {
  urls: [`${s3_url}/${s}/${s}.tif`],
  header: image as ImageHeader
};

const featParams: FeatureParams[] = [
  {
    name: 'genes',
    type: 'chunkedJSON',
    header: csc as ChunkedJSONHeader,
    url: `${s3_url}/${s}/gene_csc.bin`
  },
  {
    name: 'spotGenes',
    type: 'chunkedJSON',
    header: csr as ChunkedJSONHeader,
    url: `${s3_url}/${s}/gene_csr.bin`,
    options: { densify: false }
  }
];

const sample = new Sample({ name: s, imgParams, featParams }, true);

export default sample;
