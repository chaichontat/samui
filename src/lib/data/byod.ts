// Bring your own data.

import { browser } from '$app/environment';
import { Sample, type SampleParams } from '$lib/data/objects/sample';
import { samples, sMapp, sSample } from '$lib/store';
import { get } from 'svelte/store';
import { fromCSV } from '../io';
import type { ROIData } from '../sidebar/annotation/annROI';
import { CoordsData, type Coord } from './objects/coords';
import { valROIData } from './schemas';

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

async function processCSV(name: string, text: string) {
  const res = (await fromCSV(text))?.data;
  if (!res) {
    alert('Invalid CSV file');
    return;
  }

  if ('x' in res[0] && 'y' in res[0]) {
    get(sSample).onlineCoords[name] = new CoordsData({
      name,
      shape: 'circle',
      size: 5,
      mPerPx: get(sSample).image?.mPerPx ?? 1,
      pos: res as Coord[],
      addedOnline: true
    });
    return;
  }

  if ('id' in res[0]) {
    const ann = get(sMapp).persistentLayers.annotations;
    ann.points.loadFeatures(res as any);
    return;
  }

  alert('Unknown CSV data format');
}

export async function processHandle(
  handle: Promise<FileSystemDirectoryHandle | FileSystemFileHandle>,
  setSample = false
) {
  const h = await handle;
  if (h instanceof FileSystemFileHandle) {
    const file = await h.getFile();
    const text = await file.text();
    let proc: object | object[] | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      proc = JSON.parse(text);
    } catch (e) {
      await processCSV(file.name, text);
      return;
    }

    if (!proc) return;

    if ('rois' in proc) {
      if (valROIData(proc)) {
        const roidata = proc as ROIData;
        get(sMapp).persistentLayers.rois.loadFeatures(roidata.rois);
        return;
      }
      alert('Validation error: ' + JSON.stringify(valROIData.errors));
      return;
    }

    alert('Unknown file type.');
    return;
  }

  return processFolder(h, setSample);
}

async function processFolder(handle: FileSystemDirectoryHandle, setSample = false) {
  let sp: SampleParams;
  try {
    sp = (await readFile<SampleParams>(handle, 'sample.json', 'plain')) as SampleParams;
  } catch (e) {
    alert('Cannot find sample.json in the specified directory');
    return;
  }

  const existing = get(samples);
  const sample = new Sample(sp, handle);

  // Check if sample already exists.
  if (
    Object.keys(existing).includes(sample.name) &&
    !confirm(`Sample ${sample.name} already exists. Overwrite?`)
  ) {
    return;
  }

  samples.set({ ...existing, [sample.name]: sample });
  if (setSample) {
    sSample.set(sample);
  }
}
