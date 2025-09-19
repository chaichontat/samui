import { describe, expect, it, vi } from 'vitest';

import { ChunkedCSV, type ChunkedCSVHeader } from '$src/lib/data/objects/featureChunked';
import { PlainCSV } from '$src/lib/data/objects/featurePlain';
import { fromCSV } from '$src/lib/io';

type HeadersLike = Record<string, string> | Headers | undefined;

const CSV_FIXTURE = `x,y,value\n0,0,10\n1,1,20\n`;

const SAMPLE_HEADER: ChunkedCSVHeader = {
  length: 2,
  names: ['first', 'second'],
  ptr: [0, 1, 2],
  sparseMode: 'array'
};

const CSV_PARTS: Record<string, string> = {
  'bytes=0-0': 'index,value\n0,10\n',
  'bytes=1-1': 'index,value\n1,20\n'
};

describe('fromCSV integration', () => {
  it('parses CSV text and hydrates downstream PlainCSV feature data', async () => {
    const parsed = await fromCSV<{ x: number; y: number; value: number }>(CSV_FIXTURE, {
      header: true
    });

    expect(parsed?.data).toHaveLength(2);
    expect(parsed?.data[0]).toMatchObject({ x: 0, y: 0, value: 10 });

    const features = Object.keys(parsed!.data[0]).filter(
      (key) => !['id', 'idx', 'x', 'y'].includes(key)
    );

    const plain = new PlainCSV(
      {
        name: 'integration',
        dataType: 'quantitative',
        values: parsed!.data,
        coordName: 'coords',
        mPerPx: 1,
        size: 10
      },
      false
    );

    plain.features = features;
    await plain.hydrate();

    expect(plain.featNames).toEqual(['value']);

    const retrieved = await plain.retrieve('value');
    expect(retrieved?.dataType).toBe('quantitative');
    expect(retrieved?.data).toEqual([
      { x: 0, y: 0, value: 10 },
      { x: 1, y: 1, value: 20 }
    ]);
  });
});

describe('ChunkedCSV integration', () => {
  it('parses gzip chunks via lazy papaparse loader and densifies array data', async () => {
    const fetchCalls: RequestInfo[] = [];

    const chunked = new ChunkedCSV(
      {
        name: 'chunked',
        url: { url: 'https://example.com/chunk.csv', type: 'network' },
        headerUrl: undefined,
        header: SAMPLE_HEADER,
        coordName: 'coords',
        dataType: 'quantitative'
      },
      false
    );

    await chunked.hydrate();

    const originalFetch = global.fetch;
    const originalDecompress = ChunkedCSV.decompressBlob;

    const readRange = (headers: HeadersLike) => {
      if (!headers) return undefined;
      if (headers instanceof Headers) {
        return headers.get('Range') ?? undefined;
      }
      return headers['Range'] ?? headers['range'];
    };

    global.fetch = (async (input: RequestInfo, init?: RequestInit) => {
      fetchCalls.push(input);
      const range = readRange(init?.headers);
      const body = range ? (CSV_PARTS[range] ?? '') : '';
      return new Response(body, { status: 200, headers: { 'Content-Type': 'text/csv' } });
    }) as typeof fetch;

    const decompressSpy = vi.fn(async (blob: Blob) => await blob.text());
    ChunkedCSV.decompressBlob = decompressSpy;

    try {
      const first = await chunked.retrieve('first');
      expect(first?.data).toEqual([10, 0]);

      const second = await chunked.retrieve('second');
      expect(second?.data).toEqual([0, 20]);
    } finally {
      global.fetch = originalFetch;
      ChunkedCSV.decompressBlob = originalDecompress;
    }

    expect(fetchCalls).toHaveLength(2);
    expect(decompressSpy).toHaveBeenCalledTimes(2);
  });
});
