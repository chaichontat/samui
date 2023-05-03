// Bring your own data.

import { Sample, type SampleParams } from '$lib/data/objects/sample';
import { mapIdSample, overlays, sFeatureData, sMapp, sOverlay, sSample, samples } from '$lib/store';
import { get } from 'svelte/store';
import { fromCSV } from '../io';
import { CoordsData, type Coord } from './objects/coords';
import { valAnnFeatData, valROIData } from './schemas';

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
    alert('This browser does not support the File System API. Please use Chrome instead.');
    return;
  }

  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const handle = (await window.showDirectoryPicker()) as Promise<FileSystemDirectoryHandle>;
  return processHandle(handle, true);
}

async function processCSV(name: string, text: string) {
  const res = (await fromCSV(text))?.data;
  if (!res) {
    alert('Invalid CSV file');
    return;
  }

  if (!get(sSample)) {
    alert('Please select a sample first to open a CSV file.');
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
    console.debug('Got points data with ID');
    const ann = get(sMapp).persistentLayers.annotations;
    const coords = get(sFeatureData).coords;
    ann.points.load(res as any, coords, get(overlays)[get(sOverlay)].source);
    return;
  }

  alert('Unknown CSV data format');
}

export async function processHandle(
  handle: Promise<FileSystemDirectoryHandle | FileSystemFileHandle>,
  setSample = true
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

    if (!proc) {
      alert('Invalid JSON file');
      return;
    }

    const map = get(sMapp);
    if (!map?.persistentLayers) {
      alert('Got ROI but no map is loaded.');
      return;
    }

    if ('rois' in proc) {
      if (valAnnFeatData(proc)) {
        const annfeatdata = proc;
        console.log('Got annotation feature data');
        map.persistentLayers.annotations.loadFeatures(annfeatdata);
        return;
      }

      if (valROIData(proc)) {
        const roidata = proc;
        console.log('Got roi feature data');
        map.persistentLayers.rois.loadFeatures(roidata);
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

async function processFolder(handle: FileSystemDirectoryHandle, setSample = true) {
  let sp: SampleParams;
  try {
    sp = (await readFile<SampleParams>(handle, 'sample.json', 'plain')) as SampleParams;
  } catch (e) {
    alert('Got folder but cannot find sample.json in the specified directory');
    return;
  }

  const existing = get(samples);
  const sample = new Sample(sp, handle);

  // Check if sample already exists.
  if (
    existing.find((x) => x.name === sample.name) &&
    !confirm(`Sample ${sample.name} already exists. Overwrite?`)
  ) {
    return;
  }
  existing.push({ name: sample.name, sample });
  samples.set(existing);
  if (setSample) {
    const curr = get(mapIdSample);
    for (const id of Object.keys(curr)) {
      curr[id] = sample.name;
    }
    mapIdSample.set(curr);
    console.log('Set sample to', sample.name);
  }
}
