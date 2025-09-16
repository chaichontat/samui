import { describe, expect, it } from 'vitest';
import type { FeatureGroupList } from '../searchBox';
import { buildGroupMap, highlightMatch, filterFeatures, buildCandidateMap } from './filter';

describe('FeatureSearchBox filter helpers', () => {
  const groups: FeatureGroupList[] = [
    { group: 'genes', features: ['SNAP25', 'RORB', 'BCL11B'] },
    { group: 'proteins', features: ['NEFL', 'GFAP'] }
  ];

  const mockFind = (haystack: readonly string[], needle: string) =>
    haystack
      .filter((value) => value.toLowerCase().includes(needle.toLowerCase()))
      .map((value) => ({
        item: value,
        positions: [...value.toLowerCase()].reduce<number[]>((acc, char, idx) => {
          if (needle.toLowerCase().includes(char)) acc.push(idx);
          return acc;
        }, [])
      }));

  it('buildGroupMap creates lookup map', () => {
    const map = buildGroupMap(groups);
    expect(map.get('genes')).toEqual(['SNAP25', 'RORB', 'BCL11B']);
    expect(map.get('proteins')).toEqual(['NEFL', 'GFAP']);
  });

  it('highlightMatch wraps matching indices', () => {
    expect(highlightMatch('RORB', [0, 2])).toBe('<b>R</b>O<b>R</b>B');
    expect(highlightMatch('SNAP25', [])).toBe('SNAP25');
  });

  it('filterFeatures returns results scoped to group', () => {
    const map = buildGroupMap(groups);
    const results = filterFeatures(map, 'genes', 'ro', mockFind);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ value: 'RORB', group: 'genes' });
    expect(results[0].highlighted).toMatch(/<b>R<\/b>/);
  });

  it('filterFeatures falls back to top items when query empty', () => {
    const map = buildGroupMap(groups);
    const results = filterFeatures(map, 'proteins', '', mockFind);
    expect(results.map((r) => r.value)).toEqual(['NEFL', 'GFAP']);
  });

  it('buildCandidateMap aggregates per group results', () => {
    const map = buildGroupMap(groups);
    const result = buildCandidateMap(map, 'f', mockFind);
    expect(result.genes).toEqual([]);
    expect(result.proteins?.map((r) => r.value)).toEqual(['NEFL', 'GFAP']);
  });
});
