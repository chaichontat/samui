import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildTiffSampleParams: vi.fn()
}));

vi.mock('./tiffImport', () => ({
  MAX_BROWSER_TIFF_BYTES: 1024 ** 3,
  buildTiffSampleParams: mocks.buildTiffSampleParams,
  getTiffImportLimitMessage: () =>
    'Browser TIFF import is limited to 1 GB. Please preprocess larger TIFF files before importing them into Samui.',
  isTiffFileName: (name: string) => /\.tiff?$/i.test(name)
}));

import { mapIdSample, sMapId, samples } from '$lib/store';
import { Sample } from '$lib/data/objects/sample';
import { processHandle } from './byod';

class FakeFileSystemFileHandle {
  kind = 'file' as const;

  constructor(private readonly file: File) {}

  async getFile() {
    return this.file;
  }
}

class FakeFileSystemDirectoryHandle {
  kind = 'directory' as const;
}

beforeEach(() => {
  vi.clearAllMocks();
  samples.set([]);
  mapIdSample.set({ 0: 'initial' });
  sMapId.set(0);
  localStorage.clear();

  vi.stubGlobal('FileSystemFileHandle', FakeFileSystemFileHandle);
  vi.stubGlobal('FileSystemDirectoryHandle', FakeFileSystemDirectoryHandle);
});

describe('processHandle', () => {
  it('imports TIFF files as image-only samples and activates them', async () => {
    const noticeSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const file = new File([new Uint8Array([1, 2, 3])], 'scan.tif', { type: 'image/tiff' });

    mocks.buildTiffSampleParams.mockResolvedValue({
      name: 'scan',
      imgParams: {
        urls: [{ url: 'blob:scan', type: 'network' }],
        channels: 'rgb',
        hasPhysicalScale: false,
        mPerPx: 1,
        maxVal: 255
      }
    });

    await processHandle(Promise.resolve(new FakeFileSystemFileHandle(file)), true);

    expect(mocks.buildTiffSampleParams).toHaveBeenCalledWith(file);
    expect(get(samples)).toHaveLength(1);
    expect(get(samples)[0]?.sample).toBeInstanceOf(Sample);
    expect(get(samples)[0]?.sample.image?.channels).toBe('rgb');
    expect(get(mapIdSample)[0]).toBe('scan');
    expect(noticeSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Imported scan as an image-only TIFF sample. Pixel scale defaulted to 1 because the TIFF did not expose meter-based resolution metadata.'
      )
    );
  });

  it('does not warn about fallback scale when the TIFF has a real 1 m/px resolution', async () => {
    const noticeSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const file = new File([new Uint8Array([1, 2, 3])], 'scaled.tif', { type: 'image/tiff' });

    mocks.buildTiffSampleParams.mockResolvedValue({
      name: 'scaled',
      imgParams: {
        urls: [{ url: 'blob:scaled', type: 'network' }],
        channels: ['C1'],
        hasPhysicalScale: true,
        mPerPx: 1,
        maxVal: 255
      }
    });

    await processHandle(Promise.resolve(new FakeFileSystemFileHandle(file)), true);

    expect(noticeSpy).toHaveBeenCalledWith(
      'Imported scaled as an image-only TIFF sample. Coordinates and feature overlays still require a prepared sample folder.'
    );
  });

  it('still warns about fallback scale after the one-time TIFF notice was already shown', async () => {
    const noticeSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    localStorage.setItem('samui:tiff-import-notice', 'true');
    const file = new File([new Uint8Array([1, 2, 3])], 'fallback.tif', { type: 'image/tiff' });

    mocks.buildTiffSampleParams.mockResolvedValue({
      name: 'fallback',
      imgParams: {
        urls: [{ url: 'blob:fallback', type: 'network' }],
        channels: ['C1'],
        hasPhysicalScale: false,
        mPerPx: 1,
        maxVal: 255
      }
    });

    await processHandle(Promise.resolve(new FakeFileSystemFileHandle(file)), true);

    expect(noticeSpy).toHaveBeenCalledWith(
      'Imported fallback without meter-based resolution metadata. Pixel scale defaulted to 1, so the scale bar is hidden and any added coordinates are interpreted in pixel units.'
    );
  });

  it('blocks TIFF files larger than 1 GB before decoding', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const file = new File([new Uint8Array([1, 2, 3])], 'large.tif', { type: 'image/tiff' });
    Object.defineProperty(file, 'size', { value: 1024 ** 3 + 1 });

    await processHandle(Promise.resolve(new FakeFileSystemFileHandle(file)), true);

    expect(mocks.buildTiffSampleParams).not.toHaveBeenCalled();
    expect(get(samples)).toEqual([]);
    expect(alertSpy).toHaveBeenCalledWith(
      'Browser TIFF import is limited to 1 GB. Please preprocess larger TIFF files before importing them into Samui.'
    );
  });

  it('replaces a same-name sample after confirmation instead of duplicating it', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const existingSample = new Sample({
      name: 'scan',
      imgParams: {
        urls: [{ url: 'blob:old', type: 'network' }],
        channels: 'rgb',
        mPerPx: 2,
        maxVal: 255
      }
    });
    samples.set([{ name: 'scan', sample: existingSample }]);
    mapIdSample.set({ 0: 'scan' });

    const file = new File([new Uint8Array([1, 2, 3])], 'scan.tif', { type: 'image/tiff' });
    mocks.buildTiffSampleParams.mockResolvedValue({
      name: 'scan',
      imgParams: {
        urls: [{ url: 'blob:new', type: 'network' }],
        channels: ['C1'],
        hasPhysicalScale: false,
        mPerPx: 1,
        maxVal: 255
      }
    });

    await processHandle(Promise.resolve(new FakeFileSystemFileHandle(file)), true);

    expect(get(samples)).toHaveLength(1);
    expect(get(samples)[0]?.sample.image?.channels).toEqual(['C1']);
    expect(get(mapIdSample)[0]).toBe('scan');
    expect(revokeSpy).toHaveBeenCalledWith('blob:old');
    expect(revokeSpy).not.toHaveBeenCalledWith('blob:new');
  });

  it('revokes the new TIFF blob URL when the user declines an overwrite', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const existingSample = new Sample({
      name: 'scan',
      imgParams: {
        urls: [{ url: 'blob:old', type: 'network' }],
        channels: 'rgb',
        mPerPx: 2,
        maxVal: 255
      }
    });
    samples.set([{ name: 'scan', sample: existingSample }]);
    mapIdSample.set({ 0: 'scan' });

    const file = new File([new Uint8Array([1, 2, 3])], 'scan.tif', { type: 'image/tiff' });
    mocks.buildTiffSampleParams.mockResolvedValue({
      name: 'scan',
      imgParams: {
        urls: [{ url: 'blob:new', type: 'network' }],
        channels: ['C1'],
        hasPhysicalScale: false,
        mPerPx: 1,
        maxVal: 255
      }
    });

    await processHandle(Promise.resolve(new FakeFileSystemFileHandle(file)), true);

    expect(get(samples)).toHaveLength(1);
    expect(get(samples)[0]?.sample.image?.urls).toEqual([{ url: 'blob:old', type: 'network' }]);
    expect(revokeSpy).toHaveBeenCalledWith('blob:new');
    expect(revokeSpy).not.toHaveBeenCalledWith('blob:old');
  });

  it('keeps non-TIFF single-file imports on the existing CSV/JSON path', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const file = new File(['x,y\n0,0\n'], 'coords.csv', { type: 'text/csv' });

    await processHandle(Promise.resolve(new FakeFileSystemFileHandle(file)), true);

    expect(mocks.buildTiffSampleParams).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Please select a sample first to open a CSV file.');
  });
});
