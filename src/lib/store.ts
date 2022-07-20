import sampleList from '$lib/data/meh';
import { get, writable, type Writable } from 'svelte/store';
import type { NameWithFeature } from './data/features';
import type { Sample } from './data/sample';
import { oneLRU } from './utils';

export type Idx = { idx: number | null; source: string };

export const userState = writable({
  lockedIdx: { idx: -1, source: 'scatter' },
  currIdx: { idx: 0, source: 'scatter' },
  get locked() {
    return this.lockedIdx.idx !== -1;
  }
});

// Samples
export const sample: Writable<Sample | undefined> = writable();
export const samples: Writable<Record<string, Sample>> = writable({});
export const features: Writable<Record<OverlayName, NameWithFeature>> = writable({});
export const mapList: Writable<number[]> = writable([]);
// Maps
export function preload() {
  if (sampleList) {
    sampleList
      .then((ss) => {
        const obj = Object.fromEntries(ss.map((s) => [s.name, s]));
        samples.set({ ...obj, ...get(samples) });
      })
      .catch(console.error);
  }
}

// Changed in mapTile and byod.
// Automatically hydrates on change.

export const focus = writable({
  features: {} as Record<OverlayName, NameWithFeature>,
  overlay: '',
  mapId: 0,
  sample: ''
});

const updateSample = oneLRU((newSample: string) => {
  const s = get(samples)[newSample];
  if (!s) return;
  if (!s.hydrated) s.hydrate().catch(console.error);
  sample.set(s);
});
focus.subscribe((f) => updateSample(f.sample));

// Overlays and Features
type OverlayName = string;
export const annotating: Writable<{
  currKey: string;
  keys: string[];
  spots?: string;
  show: boolean;
}> = writable({
  curr: '',
  keys: [],
  show: true
});
