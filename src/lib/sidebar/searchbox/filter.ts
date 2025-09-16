import type { FeatureGroupList } from '../searchBox';

export type SearchCandidate = {
  group: string;
  value: string;
  highlighted: string;
};

export function buildGroupMap(featureGroup: FeatureGroupList[] | undefined) {
  if (!featureGroup?.length) return new Map<string, string[]>();
  return new Map(featureGroup.map((fg) => [fg.group ?? 'nogroups', fg.features]));
}

export function highlightMatch(value: string, indices: number[]): string {
  if (!indices.length) return value;
  const marks = new Set(indices);
  return value
    .split('')
    .map((char, idx) => (marks.has(idx) ? `<b>${char}</b>` : char))
    .join('');
}

export function filterFeatures(
  groups: Map<string, string[]>,
  selectedGroup: string,
  query: string,
  find: (haystack: readonly string[], needle: string) => Array<{ item: string; positions: number[] }>
): SearchCandidate[] {
  const features = groups.get(selectedGroup) ?? [];
  if (!features.length) return [];
  if (!query.trim()) {
    return features.slice(0, 20).map((value) => ({ group: selectedGroup, value, highlighted: value }));
  }

  return find(features, query).map(({ item, positions }) => ({
    group: selectedGroup,
    value: item,
    highlighted: highlightMatch(item, positions)
  }));
}

export function buildCandidateMap(
  groups: Map<string, string[]>,
  query: string,
  find: (haystack: readonly string[], needle: string) => Array<{ item: string; positions: number[] }>
) {
  const record: Record<string, SearchCandidate[]> = {};
  for (const [group, features] of groups) {
    record[group] = filterFeatures(
      groups,
      group,
      query,
      (haystack, needle) => find(haystack, needle)
    );
  }
  return record;
}

