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

export const activeFeatures: Writable<Record<string, HoverName<string>>> = writable({
  genes: genHoverName({ selected: 'GFAP' })
});

export const currRna: Writable<{ name: string; values: number[] }> = writable({
  name: '',
  values: []
});

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
  samples.set({ [s]: first });
  activeSample.set(s);
  const obj = sampleList ? Object.fromEntries(sampleList.map((s) => [s.name, s])) : {};
  if (s in obj) {
    console.warn('Duplicate sample name in first and meh:', s);
  }
  samples.set(Object.assign({ [s]: first }, obj));
}
