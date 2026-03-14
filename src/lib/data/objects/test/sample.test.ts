import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const coordsInstances: any[] = [];
const imageInstances: any[] = [];
const plainCsvInstances: any[] = [];
const chunkedCsvInstances: any[] = [];

vi.mock('../coords', () => {
  class FakeCoordsData {
    name: string;
    shape: string;
    mPerPx: number;
    pos?: Array<Record<string, unknown>>;
    size: number | undefined;
    hydrated = false;
    hydrate = vi.fn(async () => {
      this.hydrated = true;
      return this;
    });

    constructor(params: Record<string, any>) {
      this.name = params.name;
      this.shape = params.shape;
      this.mPerPx = params.mPerPx;
      this.size = params.size;
      this.pos = params.pos
        ? params.pos.map((p: Record<string, unknown>, idx: number) => ({ ...p, idx }))
        : undefined;
      coordsInstances.push(this);
    }

    subsample() {
      return this.pos;
    }
  }

  return {
    __esModule: true,
    CoordsData: FakeCoordsData
  };
});

vi.mock('../image', () => {
  class FakeImgData {
    params: Record<string, unknown>;
    hydrated = false;
    mPerPx: number;
    hydrate = vi.fn(async () => {
      this.hydrated = true;
      return this;
    });

    constructor(params: Record<string, unknown>) {
      this.params = params;
      this.mPerPx = params.mPerPx as number;
      imageInstances.push(this);
    }
  }

  return {
    __esModule: true,
    ImgData: FakeImgData
  };
});

vi.mock('../featurePlain', () => {
  class FakePlainCSV {
    name: string;
    dataType: string;
    coordName?: string;
    mPerPx?: number;
    size?: number;
    unit?: string;
    features?: string[];
    featNames: string[] = [];
    weights?: Record<string, number>;
    hydrated = false;
    hydrate = vi.fn(async () => {
      this.hydrated = true;
      return this;
    });
    retrieve = vi.fn();

    constructor(params: Record<string, any>) {
      this.name = params.name;
      this.dataType = params.dataType;
      this.coordName = params.coordName;
      this.mPerPx = params.mPerPx;
      this.size = params.size;
      this.unit = params.unit;
      plainCsvInstances.push(this);
    }
  }

  return {
    __esModule: true,
    PlainCSV: FakePlainCSV
  };
});

vi.mock('../featureChunked', () => {
  class FakeChunkedCSV {
    name: string;
    dataType: string;
    coordName: string;
    names?: Record<string, number>;
    featNames: string[] = [];
    weights?: Record<string, number>;
    hydrated = false;
    hydrate = vi.fn(async () => {
      this.hydrated = true;
      return this;
    });
    retrieve = vi.fn();

    constructor(params: Record<string, any>) {
      this.name = params.name;
      this.dataType = params.dataType;
      this.coordName = params.coordName;
      chunkedCsvInstances.push(this);
    }
  }

  return {
    __esModule: true,
    ChunkedCSV: FakeChunkedCSV
  };
});

import type { FeatureAndGroup } from '../feature';
import { Sample } from '../sample';

const baseUrl = { url: '/foo.csv', type: 'network' } as const;

const sampleParams = {
  name: 'sample-a',
  imgParams: {
    urls: [baseUrl],
    channels: 'rgb' as const,
    mPerPx: 0.5
  },
  coordParams: [
    {
      name: 'coords-a',
      shape: 'circle',
      mPerPx: 1,
      pos: [{ x: 1, y: 2 }],
      size: 2
    }
  ],
  featParams: [
    {
      type: 'plainCSV' as const,
      name: 'plain',
      dataType: 'quantitative' as const,
      url: baseUrl,
      coordName: 'coords-a',
      mPerPx: 1,
      size: 2
    },
    {
      type: 'chunkedCSV' as const,
      name: 'chunked',
      dataType: 'categorical' as const,
      url: baseUrl,
      coordName: 'coords-a',
      header: { length: 1, names: ['f0'], ptr: [0, 1] }
    }
  ],
  overlayParams: { defaults: [{ group: 'plain', feature: 'geneA' }] },
  notesMd: { url: '/notes.md', type: 'network' } as const,
  metadataMd: { url: '/meta.md', type: 'network' } as const
};

const resetFakes = () => {
  coordsInstances.length = 0;
  imageInstances.length = 0;
  plainCsvInstances.length = 0;
  chunkedCsvInstances.length = 0;
};

describe('Sample', () => {
  beforeEach(() => {
    resetFakes();
    vi.clearAllMocks();
  });

  it('constructs image, coordinates, and feature loaders', () => {
    const handle = {} as FileSystemDirectoryHandle;
    const sample = new Sample(sampleParams, handle);

    expect(sample.name).toBe('sample-a');
    expect(sample.handle).toBe(handle);
    expect(sample.image).toBe(imageInstances[0]);
    expect(imageInstances).toHaveLength(1);
    expect(imageInstances[0].params).toMatchObject(sampleParams.imgParams);

    expect(Object.keys(sample.coords)).toEqual(['coords-a']);
    expect(sample.coords['coords-a']).toBe(coordsInstances[0]);

    expect(Object.keys(sample.features)).toEqual(['plain', 'chunked']);
    expect(sample.features['plain']).toBe(plainCsvInstances[0]);
    expect(sample.features['chunked']).toBe(chunkedCsvInstances[0]);
    expect(sample.overlayParams).toEqual(sampleParams.overlayParams);
    expect(sample.notesMd).toEqual(sampleParams.notesMd);
    expect(sample.metadataMd).toEqual(sampleParams.metadataMd);
  });

  it('reports feature availability and returns the first available feature', async () => {
    const sample = new Sample(sampleParams);
    await sample.hydrate();
    plainCsvInstances[0].featNames = ['geneA', 'geneB'];
    chunkedCsvInstances[0].featNames = ['proteinX'];
    chunkedCsvInstances[0].names = { proteinX: 0 };

    expect(sample.hasFeature({ group: 'plain', feature: 'geneA' })).toBe(true);
    expect(sample.hasFeature({ group: 'plain', feature: 'missing' })).toBe(false);
    expect(sample.hasFeature({ group: 'chunked', feature: 'proteinX' })).toBe(true);

    const first = await sample.firstFeature();
    expect(first).toEqual({ group: 'plain', feature: 'geneA' });
  });

  it('hydrates image and features once', async () => {
    const handle = { kind: 'dir' } as unknown as FileSystemDirectoryHandle;
    const sample = new Sample(sampleParams, handle);

    await sample.hydrate();
    expect(imageInstances[0].hydrate).toHaveBeenCalledWith(handle);
    expect(plainCsvInstances[0].hydrate).toHaveBeenCalledWith(handle);
    expect(chunkedCsvInstances[0].hydrate).toHaveBeenCalledWith(handle);
    expect(sample.hydrated).toBe(true);

    await sample.hydrate();
    expect(imageInstances[0].hydrate).toHaveBeenCalledTimes(1);
    expect(plainCsvInstances[0].hydrate).toHaveBeenCalledTimes(1);
    expect(chunkedCsvInstances[0].hydrate).toHaveBeenCalledTimes(1);
  });

  describe('getFeature', () => {
    let sample: Sample;

    beforeEach(() => {
      sample = new Sample(sampleParams);
    });

    it('hydrates existing coordinates when coordName provided', async () => {
      const feature = sample.features['plain'] as any;
      feature.retrieve.mockResolvedValueOnce({
        dataType: 'quantitative',
        data: [{ x: 1, y: 2, value: 3 }],
        coordName: 'coords-a',
        size: 4,
        mPerPx: 0.25
      });

      const target: FeatureAndGroup = { group: 'plain', feature: 'geneA' };
      const result = await sample.getFeature(target);

      expect(feature.retrieve).toHaveBeenCalledWith('geneA');
      const coords = sample.coords['coords-a'] as any;
      expect(coords.hydrate).toHaveBeenCalled();
      expect(result?.coords).toBe(coords);
      expect(result?.data).toEqual([3]);
      expect(result?.minmax).toEqual([3, 3]);
      expect(result?.name).toEqual(target);
    });

    it('generates new coordinates when coordName missing', async () => {
      const feature = sample.features['chunked'] as any;
      feature.retrieve.mockResolvedValueOnce({
        dataType: 'quantitative',
        data: [
          { x: 0, y: 1, value: 5 },
          { x: 2, y: 3, value: 7 }
        ],
        size: 2,
        mPerPx: 0.5
      });

      const target: FeatureAndGroup = { group: 'chunked', feature: 'geneB' };
      const result = await sample.getFeature(target);

      expect(feature.retrieve).toHaveBeenCalledWith('geneB');
      const generated = result?.coords as any;
      expect(coordsInstances).toContain(generated);
      expect(generated.name).toBe('chunked-geneB');
      expect(generated.pos).toHaveLength(2);
      expect(result?.coords).toBe(generated);
      expect(result?.data).toEqual([5, 7]);
      expect(result?.minmax).toEqual([5, 7]);
    });

    it('coerces singular data to unit weights', async () => {
      const feature = sample.features['chunked'] as any;
      feature.retrieve.mockResolvedValueOnce({
        dataType: 'singular',
        data: [
          { x: 1, y: 1 },
          { x: 2, y: 2 }
        ],
        size: 1,
        mPerPx: 1
      });

      const target: FeatureAndGroup = { group: 'chunked', feature: 'singular' };
      const result = await sample.getFeature(target);

      expect(result?.data).toEqual([1, 1]);
      expect(coordsInstances).toContain(result?.coords);
    });
  });

  it('builds feature list after hydration', async () => {
    const sample = new Sample(sampleParams);
    const plain = sample.features['plain'] as any;
    plain.features = ['geneA', 'geneB'];
    plain.weights = { geneA: 0.4 };

    const chunked = sample.features['chunked'] as any;
    chunked.names = { geneC: 0, geneD: 1 };
    chunked.featNames = Object.keys(chunked.names);
    chunked.weights = { geneC: 0.7 };

    await sample.hydrate();
    const list = await sample.genFeatureList();

    expect(list).toEqual([
      { group: 'plain', features: ['geneA', 'geneB'], weights: { geneA: 0.4 } },
      { group: 'chunked', features: ['geneC', 'geneD'], weights: { geneC: 0.7 } }
    ]);
  });
});
