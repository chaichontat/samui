import { beforeEach, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { writeArrayBuffer } from 'geotiff';
import { get } from 'svelte/store';

import { Sample } from '$src/lib/data/objects/sample';
import { buildTiffImageParams } from '$src/lib/data/tiffImport';
import { mapIdSample, samples, sMapp, sSample } from '$src/lib/store';

import MainMap from './mainMap.svelte';
import reg0045Url from '../../e2e/reg-0045--reg-0045_z10.tif?url';
import stitchedUrl from '../../out/stitched.tif?url';

beforeEach(() => {
  samples.set([]);
  mapIdSample.set({ 0: 'tiff-sample' });
  sSample.set(undefined);
});

it('keeps the sidebar hidden while an image-only sample remains selectable', async () => {
  const buffer = writeArrayBuffer(
    [
      [
        [0, 255],
        [128, 64]
      ]
    ],
    { width: 2, height: 2 }
  );
  const url = URL.createObjectURL(new Blob([buffer], { type: 'image/tiff' }));
  const sample = new Sample({
    name: 'tiff-sample',
    imgParams: {
      urls: [{ url, type: 'network' }],
      channels: ['C1'],
      hasPhysicalScale: false,
      mPerPx: 1,
      maxVal: 255
    }
  });

  samples.set([{ name: sample.name, sample }]);
  sSample.set(sample);

  const screen = await render(MainMap);

  await expect.poll(() => screen.container.querySelector('aside')).toBeNull();
  await expect
    .poll(() => screen.container.querySelector('[data-testid="sample-select"]'))
    .not.toBeNull();
  await expect.poll(() => screen.container.querySelector('.ol-scale-line')).toBeNull();

  screen.unmount();
  URL.revokeObjectURL(url);
});

it('shows the scale bar when the image has a real pixel scale', async () => {
  const buffer = writeArrayBuffer(
    [
      [
        [0, 255],
        [128, 64]
      ]
    ],
    { width: 2, height: 2 }
  );
  const url = URL.createObjectURL(new Blob([buffer], { type: 'image/tiff' }));
  const sample = new Sample({
    name: 'scaled-sample',
    imgParams: {
      urls: [{ url, type: 'network' }],
      channels: ['C1'],
      mPerPx: 0.5,
      maxVal: 255
    }
  });

  mapIdSample.set({ 0: 'scaled-sample' });
  samples.set([{ name: sample.name, sample }]);
  sSample.set(sample);

  const screen = await render(MainMap);

  await expect.poll(() => screen.container.querySelector('.ol-scale-line')).not.toBeNull();

  screen.unmount();
  URL.revokeObjectURL(url);
});

it('shows the scale bar when the image has a real 1 m/px scale', async () => {
  const buffer = writeArrayBuffer(
    [
      [
        [0, 255],
        [128, 64]
      ]
    ],
    { width: 2, height: 2 }
  );
  const url = URL.createObjectURL(new Blob([buffer], { type: 'image/tiff' }));
  const sample = new Sample({
    name: 'meter-scale-sample',
    imgParams: {
      urls: [{ url, type: 'network' }],
      channels: ['C1'],
      hasPhysicalScale: true,
      mPerPx: 1,
      maxVal: 255
    }
  });

  mapIdSample.set({ 0: 'meter-scale-sample' });
  samples.set([{ name: sample.name, sample }]);
  sSample.set(sample);

  const screen = await render(MainMap);

  await expect.poll(() => screen.container.querySelector('.ol-scale-line')).not.toBeNull();

  screen.unmount();
  URL.revokeObjectURL(url);
});

it('hides the scale bar when TIFF imports fall back to a synthetic 1 m/px scale', async () => {
  const blob = await fetch(reg0045Url).then((response) => response.blob());
  const objectUrl = URL.createObjectURL(blob);
  const sample = new Sample({
    name: 'reg-0045',
    imgParams: {
      urls: [{ url: objectUrl, type: 'network' }],
      channels: ['C1', 'C2'],
      hasPhysicalScale: false,
      mPerPx: 1,
      maxVal: 65535
    }
  });

  mapIdSample.set({ 0: 'reg-0045' });
  samples.set([{ name: sample.name, sample }]);
  sSample.set(sample);

  const screen = await render(MainMap);

  await expect
    .poll(() => screen.container.querySelector('[data-testid="sample-select"]'))
    .not.toBeNull();
  await expect.poll(() => screen.container.querySelector('.ol-scale-line')).toBeNull();

  screen.unmount();
  URL.revokeObjectURL(objectUrl);
});

it('imports and renders multi-page stitched TIFFs as separate channels', async () => {
  const fileBlob = await fetch(stitchedUrl).then((response) => response.blob());
  const file = new File([fileBlob], 'stitched.tif', { type: 'image/tiff' });
  const imgParams = await buildTiffImageParams(file);
  const sample = new Sample({
    name: 'stitched',
    imgParams
  });

  mapIdSample.set({ 0: 'stitched' });
  samples.set([{ name: sample.name, sample }]);
  sSample.set(sample);

  const screen = await render(MainMap);

  await expect
    .poll(() => screen.container.querySelector('[data-testid="sample-select"]'))
    .not.toBeNull();
  await expect.poll(() => screen.container.querySelector('.ol-scale-line')).toBeNull();
  await expect.poll(() => get(sMapp)?.persistentLayers.background.geoTiffSource).toBeUndefined();
  await expect
    .poll(() => get(sMapp)?.persistentLayers.background.viewOptions?.extent)
    .toEqual([0, -16384, 12800, 0]);

  screen.unmount();
});
