import { describe, expect, it } from 'vitest';
import type { FeatureGroupList } from '../searchBox';
import {
  buildGroupMeta,
  deriveSearchInput,
  hasAvailableFeatures,
  overlaySelectionFeature
} from './state';

describe('FeatureSearchBox state helpers', () => {
  const featureGroup: FeatureGroupList[] = [
    { group: 'genes', features: ['SNAP25', 'RORB', 'BCL11B'] },
    { group: 'proteins', features: ['NEFL', 'GFAP'] }
  ];

  it('detects when no features are available', () => {
    expect(hasAvailableFeatures(undefined)).toBe(false);
    expect(hasAvailableFeatures([{ group: 'empty', features: [] }])).toBe(false);
    expect(hasAvailableFeatures(featureGroup)).toBe(true);
  });

  it('computes group metadata retaining previous selection when possible', () => {
    const initial = buildGroupMeta(featureGroup, undefined);
    expect(initial.groups).toEqual(['genes', 'proteins']);
    expect(initial.selectItems[0]).toEqual({ value: 'genes', label: 'genes' });
    expect(initial.selectedGroup).toBe('genes');

    const next = buildGroupMeta(featureGroup, 'proteins');
    expect(next.selectedGroup).toBe('proteins');

    const fallback = buildGroupMeta([{ group: 'a', features: [] }], 'proteins');
    expect(fallback.selectedGroup).toBe('a');
  });

  it('derives search input from selected feature when not actively searching', () => {
    const prev = deriveSearchInput({
      showSearch: false,
      displaySelection: true,
      selected: { group: 'genes', feature: 'RORB' },
      previous: ''
    });
    expect(prev).toBe('RORB');

    const unchanged = deriveSearchInput({
      showSearch: true,
      displaySelection: true,
      selected: { group: 'genes', feature: 'RORB' },
      previous: 'RO'
    });
    expect(unchanged).toBe('RO');
  });

  it('returns overlay selection feature when available', () => {
    const overlays = {
      a: { group: 'genes', feature: 'SNAP25' },
      b: undefined
    };
    expect(overlaySelectionFeature(overlays, 'a', '')).toBe('SNAP25');
    expect(overlaySelectionFeature(overlays, 'b', 'prev')).toBe('prev');
  });
});
