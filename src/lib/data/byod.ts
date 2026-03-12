// Bring your own data.

import { Sample, type SampleParams } from '$lib/data/objects/sample';
import {
  mapIdSample,
  overlays,
  sFeatureData,
  sMapId,
  sMapp,
  sOverlay,
  sSample,
  samples
} from '$lib/store';
import { get } from 'svelte/store';
import { fromCSV } from '../io';
import { CoordsData, type Coord } from './objects/coords';
import { valAnnFeatData, valROIData } from './schemas';
import {
  buildTiffSampleParams,
  getTiffImportLimitMessage,
  isTiffFileName,
  MAX_BROWSER_TIFF_BYTES
} from './tiffImport';

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
    if (isTiffFileName(file.name)) {
      await processTiff(file, setSample);
      return;
    }

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

    if ('type' in proc) {
      if (valROIData(proc)) {
        const roidata = proc;
        console.log('Got roi feature data');
        map.persistentLayers.rois.loadFeatures(roidata);
        return;
      }

      if (valAnnFeatData(proc)) {
        const annfeatdata = proc;
        console.log('Got annotation feature data');
        map.persistentLayers.annotations.loadFeatures(annfeatdata);
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

function registerImportedSample(sample: Sample, setSample = true) {
  const existing = [...get(samples)];
  const existingIdx = existing.findIndex((entry) => entry.name === sample.name);

  if (existingIdx >= 0 && !confirm(`Sample ${sample.name} already exists. Overwrite?`)) {
    sample.dispose();
    return false;
  }

  if (existingIdx >= 0) {
    existing.splice(existingIdx, 1, { name: sample.name, sample });
  } else {
    existing.push({ name: sample.name, sample });
  }
  samples.set(existing);

  if (setSample) {
    const curr = { ...get(mapIdSample) };
    if (Object.keys(curr).length === 0) {
      curr[get(sMapId)] = sample.name;
    } else {
      for (const id of Object.keys(curr)) {
        curr[id] = sample.name;
      }
    }
    mapIdSample.set(curr);
    console.log('Set sample to', sample.name);
  }

  return true;
}

async function processTiff(file: File, setSample = true) {
  if (file.size > MAX_BROWSER_TIFF_BYTES) {
    alert(getTiffImportLimitMessage());
    return;
  }

  try {
    const params = await buildTiffSampleParams(file);
    const sample = new Sample(params);
    const imported = registerImportedSample(sample, setSample);
    if (!imported) {
      return;
    }

    if (!localStorage.getItem('samui:tiff-import-notice')) {
      const scaleMessage =
        params.imgParams?.hasPhysicalScale === false
          ? ' Pixel scale defaulted to 1 because the TIFF did not expose meter-based resolution metadata.'
          : '';
      alert(
        `Imported ${sample.name} as an image-only TIFF sample.${scaleMessage} Coordinates and feature overlays still require a prepared sample folder.`
      );
      localStorage.setItem('samui:tiff-import-notice', 'true');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to import TIFF file.';
    alert(message);
  }
}

async function processFolder(handle: FileSystemDirectoryHandle, setSample = true) {
  let sp: SampleParams;
  try {
    sp = (await readFile<SampleParams>(handle, 'sample.json', 'plain')) as SampleParams;
  } catch (e) {
    alert('Got folder but cannot find sample.json in the specified directory');
    return;
  }

  const sample = new Sample(sp, handle);
  registerImportedSample(sample, setSample);
}
