import { writable, type Writable } from 'svelte/store';

export type State = {
  lockedIdx: { idx: number; source: 'scatter' | 'map' };
  // lockedCoords: { x: number; y: number };
  currIdx: { idx: number; source: 'scatter' | 'map' };
  readonly locked: boolean;
  // currCoords: { x: number; y: number };
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

export const multipleSelect: Writable<number[]> = writable([]);

export const params = { spotDiam: 65e-6, mPerPx: 0.497e-6 };

export const genes: Writable<{ ptr: number[]; names: Record<string, number> }> = writable({
  ptr: [],
  names: {}
});
