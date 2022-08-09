/// Only for search box.
export type FeatureGroupList = {
  group: string | null;
  features: string[];
};

export class HoverSelect<T> {
  hover: T | null = null;
  selected: T | null = null;

  constructor(initial: { hover?: T; selected?: T } = {}) {
    this.update(initial);
  }

  get active() {
    return this.hover ?? this.selected;
  }

  update({ hover, selected }: { hover?: T | null; selected?: T | null }) {
    if (hover !== undefined) this.hover = hover;
    if (selected !== undefined) this.selected = selected;
  }
}
