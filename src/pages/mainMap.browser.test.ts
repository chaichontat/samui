import { beforeEach, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { writeArrayBuffer } from 'geotiff';
import { get } from 'svelte/store';

import { Sample } from '$src/lib/data/objects/sample';
import { mapIdSample, samples, sMapp, sSample } from '$src/lib/store';

import MainMap from './mainMap.svelte';

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
  const objectUrl = URL.createObjectURL(
    new Blob(
      [
        writeArrayBuffer(
          [
            [
              [0, 65535],
              [32768, 16384]
            ],
            [
              [65535, 0],
              [16384, 32768]
            ]
          ],
          { width: 2, height: 2 }
        )
      ],
      { type: 'image/tiff' }
    )
  );
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

it('renders explicit split-page local TIFF sources as separate channels', async () => {
  const firstUrl = URL.createObjectURL(
    new Blob(
      [
        writeArrayBuffer(
          [
            [
              [0, 255, 128, 64],
              [32, 96, 160, 224]
            ]
          ],
          { width: 4, height: 2 }
        )
      ],
      { type: 'image/tiff' }
    )
  );
  const secondUrl = URL.createObjectURL(
    new Blob(
      [
        writeArrayBuffer(
          [
            [
              [255, 0, 64, 128],
              [224, 160, 96, 32]
            ]
          ],
          { width: 4, height: 2 }
        )
      ],
      { type: 'image/tiff' }
    )
  );
  const sample = new Sample({
    name: 'stitched',
    imgParams: {
      urls: [
        { url: firstUrl, type: 'network' },
        { url: secondUrl, type: 'network' }
      ],
      channels: ['DAPI', 'GFAP'],
      hasPhysicalScale: false,
      mPerPx: 1,
      maxVal: 255,
      renderMode: 'local-tiff',
      size: { width: 4, height: 2 }
    }
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
    .toEqual([0, -2, 4, 0]);

  screen.unmount();
  URL.revokeObjectURL(firstUrl);
  URL.revokeObjectURL(secondUrl);
});
