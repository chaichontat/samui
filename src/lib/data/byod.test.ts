import { upsertSampleEntry } from '$src/lib/data/byod';
import type { Sample } from '$src/lib/data/objects/sample';
import { describe, expect, it } from 'vitest';

describe('upsertSampleEntry', () => {
  const makeSample = (name: string, marker: string) => ({
    name,
    sample: { marker } as unknown as Sample
  });

  it('replaces existing sample entries by name', () => {
    const remote = makeSample('demo', 'remote');
    const local = makeSample('demo', 'local');

    const updated = upsertSampleEntry([remote], local);
    expect(updated).toHaveLength(1);
    expect(updated[0]).not.toBe(remote);
    expect(updated[0].sample).toBe(local.sample);
  });

  it('appends when no matching name exists', () => {
    const first = makeSample('a', 'first');
    const second = makeSample('b', 'second');

    const result = upsertSampleEntry([first], second);
    expect(result).toHaveLength(2);
    expect(result[1]).toBe(second);
  });
});
