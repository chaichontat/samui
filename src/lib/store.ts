import first from '$lib/data/first';
import sampleList from '$lib/data/meh';
import { writable, type Writable } from 'svelte/store';
import type { Sample } from './data/sample';

export type Idx = { idx: number; source: string };

export type State = {
  lockedIdx: Idx;
  currIdx: Idx;
  readonly locked: boolean;
};

export const store: Writable<State> = writable({
  lockedIdx: { idx: -1, source: 'scatter' },
  currIdx: { idx: 0, source: 'scatter' },
  get locked() {
    return this.lockedIdx.idx !== -1;
  }
});

export type HoverName<T> = {
  hover: T | null;
  selected: T | null;
  get active(): T | null;
};

export type FeatureName<T> = {
  feature?: string;
  name?: T;
};

export function genHoverName<T>({ hover, selected }: { hover?: T; selected?: T }): HoverName<T> {
  return {
    hover: hover ?? null,
    selected: selected ?? null,
    get active() {
      if (this.hover) return this.hover;
      return this.selected;
    }
  };
}

export const activeFeatures: Writable<FeatureName<string>> = writable({});

export const genes: Writable<{ ptr: number[]; names: Record<string, number> }> = writable({
  ptr: [],
  names: {}
});

export const multipleSelect: Writable<number[]> = writable([]);

const s = first.name;

export const activeSample: Writable<string> = writable('');
export const samples: Writable<{ [key: string]: Sample }> = writable({});

const preload = true;
if (preload) {
  first.promise
    .then(() => {
      samples.set({ [s]: first });
      activeSample.set(s);
    })
    .catch(console.error);

  if (sampleList) {
    sampleList
      .then((ss) => {
        const obj = Object.fromEntries(ss.map((s) => [s.name, s]));
        samples.set(Object.assign({ [s]: first }, obj));
      })
      .catch(console.error);
  }
}
