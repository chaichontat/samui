import { oneLRU } from '../utils';
import { ChunkedJSON, PlainJSON, type Data } from './features';

export class HoverSelect<T> {
  hover: T | null = null;
  selected: T | null = null;

  constructor(initial: { hover?: T; selected?: T } = {}) {
    this.update(initial);
  }

  get active() {
    return this.hover ?? this.selected;
  }

  update = oneLRU(({ hover, selected }: { hover?: T | null; selected?: T | null }) => {
    if (hover !== undefined) this.hover = hover;
    if (selected !== undefined) this.selected = selected;
  });
}

export type FeatureGroupList = {
  group?: string;
  features: string[];
};

export async function updateNames(
  features: Record<string, Data>,
  filterOverlay: string
): Promise<FeatureGroupList[]> {
  if (!features) return [];
  const out: FeatureGroupList[] = [{ group: undefined, features: [] }];
  for (const [name, f] of Object.entries(features)) {
    if (f.overlay !== filterOverlay) continue;
    if (f instanceof PlainJSON) {
      out[0].features.push(name);
    } else if (f instanceof ChunkedJSON) {
      await f.promise;
      out.push({ group: name, features: Object.keys(f.header!.names!) });
    } else {
      throw new Error('Unknown feature type');
    }
  }
  return out;
}
