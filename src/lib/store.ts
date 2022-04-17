import { writable, type Writable } from 'svelte/store';
import type { Sample } from './data/sample';

export type State = {
  lockedIdx: { idx: number; source: 'scatter' | 'map' };
  currIdx: { idx: number; source: 'scatter' | 'map' };
  readonly locked: boolean;
};

export const store: Writable<State> = writable({
  lockedIdx: { idx: -1, source: 'scatter' },
  currIdx: { idx: 0, source: 'scatter' },
  get locked() {
    return this.lockedIdx.idx !== -1;
  }
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

export const activeSample: Writable<string> = writable('');
export const samples: Writable<{ [key: string]: Sample }> = writable({});
export const done: Writable<boolean> = writable(false);
