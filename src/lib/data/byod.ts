// Bring your own data.

import { browser } from '$app/environment';
import { Sample, type SampleParams } from '$lib/data/objects/sample';
import { samples, sMapp, sSample } from '$lib/store';
import Ajv, { type JSONSchemaType } from 'ajv';
import { get } from 'svelte/store';
import type { ROIData } from '../sidebar/annotation/annROI';

async function readFile<T extends object>(
  dirHandle: FileSystemDirectoryHandle,
  name: string,
  mode: 'url' | 'plain'
): Promise<T | string> {
  const file = await dirHandle.getFileHandle(name).then((fileHandle) => fileHandle.getFile());

  if (mode === 'plain') {
    return JSON.parse(await file.text()) as T;
  } else {
    return URL.createObjectURL(file);
  }
}

export async function byod() {
  if (!('showDirectoryPicker' in window)) {
    alert('This browser does not support the File System API. Use Chrome/Safari.');
    return;
  }

  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const handle = (await window.showDirectoryPicker()) as Promise<FileSystemDirectoryHandle>;
  return processHandle(handle);
}

interface SelectionData {
  sample: string;
  time: string;
  mPerPx: number;
  rois: ROIData[];
}

const schema: JSONSchemaType<SelectionData> = {
  type: 'object',
  properties: {
    sample: { type: 'string' },
    time: { type: 'string' },
    mPerPx: { type: 'number' },
    rois: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['Polygon', 'Circle', 'Point'] },
          color: { type: 'string', nullable: true },
          coords: {
            oneOf: [
              { type: 'array', items: { type: 'number' } },
              {
                type: 'array',
                items: {
                  type: 'array',
                  items: {
                    type: 'array',
                    items: { type: 'number' }
                  }
                }
              }
            ]
          },
          radius: { type: 'number', nullable: true },
          properties: { type: 'object', nullable: true }
        },
        required: ['name', 'type', 'coords']
      }
    }
  },
  required: ['sample', 'rois'],
  additionalProperties: false
};

const ajv = new Ajv();
const validate = ajv.compile<SelectionData>(schema);

export async function processHandle(
  handle: Promise<FileSystemDirectoryHandle | FileSystemFileHandle>,
  setSample = false
) {
  const h = await handle;
  if (h.kind === 'file') {
    const file = await h.getFile();
    const text = await file.text();
    const proc = JSON.parse(text);

    if ('rois' in proc) {
      if (validate(proc)) {
        const rois = proc.rois;
        get(sMapp).persistentLayers.rois.loadFeatures(rois);
        return;
      }
      console.error(validate.errors);
    }
    return;
  }

  return processFolder(handle, setSample);
}

async function processFolder(handle: Promise<FileSystemDirectoryHandle>, setSample = false) {
  let sp: SampleParams;
  try {
    sp = (await readFile<SampleParams>(await handle, 'sample.json', 'plain')) as SampleParams;
  } catch (e) {
    alert('Cannot find sample.json in the specified directory');
    return;
  }

  sp.handle = await handle;
  const sample = new Sample(sp);
  samples.set({ ...get(samples), [sample.name]: sample });
  if (setSample) {
    sSample.set(sample);
  }
}
