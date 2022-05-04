import first from '$lib/data/first';
import sampleList from '$lib/data/meh';
import { get, writable, type Writable } from 'svelte/store';
import type { Sample } from './data/sample';
import { updateNames } from './data/searchBox';

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

export type CurrSample = {
  sample: Sample;
  featureNames?: FeatureName<string>[];
};

export const currSample: Writable<CurrSample | undefined> = writable();

export async function updateSample(s: Sample) {
  if (!s.hydrated) await s.hydrate();
  return { featureNames: updateNames(s.features), sample: s };
}

activeSample.subscribe((n) => {
  const ss = get(samples);
  if (!ss[n]) {
    currSample.set(undefined);
    return;
  }
  updateSample(ss[n])
    .then((r) => currSample.set(r))
    .catch(console.error);
});

// In case that a new sample is added that matches the active sample.
samples.subscribe((s) => {
  if (!get(currSample)) {
    const sample = s[get(activeSample)];
    if (sample) {
      updateSample(sample)
        .then((r) => currSample.set(r))
        .catch(console.error);
    }
  }
});

const preload = true;
if (preload) {
  first.promise
    .then(() => {
      samples.set({ [s]: first, ...get(samples) });
    })
    .catch(console.error);

  if (sampleList) {
    sampleList
      .then((ss) => {
        const obj = Object.fromEntries(ss.map((s) => [s.name, s]));
        samples.set({ ...obj, ...get(samples) });
      })
      .catch(console.error);
  }
}
