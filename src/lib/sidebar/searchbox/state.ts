import type { FeatureAndGroup } from '$src/lib/data/objects/feature';
import type { FeatureGroupList } from '../searchBox';

export function hasAvailableFeatures(featureGroup: FeatureGroupList[] | undefined) {
  if (!featureGroup?.length) return false;
  return featureGroup.some((group) => group.features.length > 0);
}

export function buildGroupMeta(
  featureGroup: FeatureGroupList[] | undefined,
  previous?: string
) {
  const groups = featureGroup?.map((f) => f.group ?? 'Misc.') ?? [];
  const selectItems = groups.map((group) => ({ value: group, label: group }));
  let selectedGroup = previous && groups.includes(previous) ? previous : groups[0] ?? '';
  return { groups, selectItems, selectedGroup };
}

export function deriveSearchInput(params: {
  showSearch: boolean;
  displaySelection: boolean;
  selected: FeatureAndGroup | undefined;
  previous: string;
}) {
  const { showSearch, displaySelection, selected, previous } = params;
  if (!showSearch && displaySelection && selected?.feature) {
    return selected.feature;
  }
  return previous;
}

export function overlaySelectionFeature(
  overlays: Record<string, FeatureAndGroup | undefined>,
  overlayId: string | undefined,
  fallback: string
) {
  if (!overlayId) return fallback;
  const feature = overlays[overlayId]?.feature;
  return feature ?? fallback;
}
