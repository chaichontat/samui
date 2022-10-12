/// Only for search box.
export type FeatureGroupList = {
  group: string | null;
  features: string[];
  names: Record<string, number>;
  weights?: number[];
};

export class HoverSelect<T> {
  hover?: T = undefined;
  selected?: T = undefined;

  constructor(initial: { hover?: T; selected?: T } = {}) {
    this.update(initial);
  }

  get active() {
    console.log(this.hover ?? this.selected);
    return this.hover ?? this.selected;
  }

  update({ hover, selected }: { hover?: T; selected?: T }) {
    this.hover = hover;
    if (selected != undefined) this.selected = selected;
    return this;
  }
}
