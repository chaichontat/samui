import sampleList from '$lib/data/meh';
import { get, writable, type Writable } from 'svelte/store';
import type { Sample } from './data/sample';

export type Idx = { id?: number | string | null; idx: number; source: string };

// TODO: deprecate
export const userState = writable({
  lockedIdx: { idx: -1, source: 'scatter' },
  currIdx: { idx: 0, source: 'scatter' },
  get locked() {
    return this.lockedIdx.idx !== -1;
  }
});

// Samples
export const samples: Writable<Record<string, Sample>> = writable({});
export const mapList: Writable<number[]> = writable([]);

// Set active map.
export const sSample = writable(undefined as Sample | undefined);
export const sMapId = writable(0);
export const mapIdSample: Writable<Record<number, string>> = writable({});

sMapId.subscribe((id: number) => {
  if (get(mapIdSample)[id] !== get(sSample)?.name) {
    sSample.set(get(samples)[get(mapIdSample)[id]]);
  }
});

mapIdSample.subscribe((v) => {
  if (v[get(sMapId)] !== get(sSample)?.name) {
    sSample.set(get(samples)[v[get(sMapId)]]);
  }
});

// Maps
export function preload() {
  if (sampleList) {
    sampleList
      .then((ss) => {
        const obj = Object.fromEntries(ss.map((s) => [s.name, s]));
        samples.set({ ...obj, ...get(samples) });
        console.log('Preloaded samples');
      })
      .catch(console.error);
  }
}

export const sId = writable({ idx: -1, source: 'scatter' } as Idx);
export const sOverlay = writable(undefined as string | undefined);
/// Overlay -> Group/feature
export const sFeature = writable({} as Record<string, { group: string; feature: string }>);

export const annotating: Writable<{
  currKey: number | null;
  keys: string[];
  spots?: string;
  show: boolean;
}> = writable({
  currKey: null,
  keys: [],
  show: true
});
