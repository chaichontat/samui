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

export type FeatureNamesGroup = {
  feature?: string;
  names: string[];
};

export async function updateNames(
  features: Record<string, Data>,
  filterOverlay: string
): Promise<FeatureNamesGroup[]> {
  if (!features) return [];
  const out: FeatureNamesGroup[] = [{ feature: undefined, names: [] }];
  for (const [name, f] of Object.entries(features)) {
    if (f.overlay !== filterOverlay) continue;
    if (f instanceof PlainJSON) {
      out[0].names.push(name);
    } else if (f instanceof ChunkedJSON) {
      await f.promise;
      out.push({ feature: name, names: Object.keys(f.header!.names!) });
    } else {
      throw new Error('Unknown feature type');
    }
  }
  return out;
}
