import sampleList from '$lib/data/meh';
import { isEqual } from 'lodash-es';
import { get, readable, writable, type Writable } from 'svelte/store';
import type { FeatureAndGroup, FeatureData } from './data/features';
import type { OverlayData } from './data/overlay';
import type { Sample } from './data/sample';
import { oneLRU } from './utils';

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
// Maps
export function preload() {
  if (sampleList) {
    sampleList
      .then(async (ss) => {
        const obj = Object.fromEntries(ss.map((s) => [s.name, s]));
        samples.set({ ...obj, ...get(samples) });
        await setSample(ss[0].name);
        console.log('Preloaded samples');
      })
      .catch(console.error);
  }
}

export const sMapId = writable(0);
export const sId = writable({ idx: -1, source: 'scatter' } as Idx);
export const sSample = writable(undefined as Sample | undefined);
export const sOverlay = writable(undefined as OverlayData | undefined);
export const sFeature = writable(undefined as FeatureAndGroup | undefined);
export const sValues = writable(
  undefined as { dataType: 'quantitative' | 'categorical'; data: (number | string)[] } | undefined
);
// TODO: Idea is to switch sSample, sOverlay, sFeature, sValues back to string. Then, create a shared function to get the data based on mapId.

export async function setSample(s: string) {
  if (!s) return;
  if (s === get(sSample)?.name) return;
  const sa = get(samples)[s];
  await sa.hydrate();
  sSample.set(sa);

  const ol = get(sOverlay);
  if (ol && ol.name in sa.overlays) {
    await setOverlay(ol.name, true);
  } else {
    await setOverlay(Object.values(sa.overlays)[0].name);
  }
}

export async function setOverlay(o: string, newSample = false) {
  if (o === get(sOverlay)?.name && !newSample) return;
  const ol = get(sSample)?.overlays[o];
  if (!ol) throw new Error(`Overlay ${o} not found in sample.`);
  sOverlay.set(ol);
  return await setFeature(get(sFeature), true);
}

export async function setFeature(fg: FeatureAndGroup | undefined, newOl = false) {
  if (newOl) {
    const group = Object.values(get(sOverlay)!.featgroups)[0];
    await group.hydrate();
    const f = group.featNames![0];
    sFeature.set({ group: group.name, feature: f });
    sValues.set(await group.retrieve(f));
    return;
  }

  if (isEqual(fg, get(sFeature)) && !newOl) return;

  const group = get(sOverlay)?.featgroups[fg.group];
  if (!group) {
    console.error(`Feature group ${fg.group} not found in overlay.`);
    return;
  }

  // TODO: fix first init.
  // const f = await group.retrieve(fg.feature);
  // if (f) {
  //   this.feature.set(fg);
  //   this.values.set(f);
  // } else if (newOl) {
  //   const group = Object.values(get(this.overlay)!.featgroups)[0];
  //   await group.hydrate();
  //   const feature = group.featNames![0];
  //   this.feature.set({ group: group.name, feature });
  //   this.values.set(await group.retrieve(feature));
  // }
}

// const updateSample = oneLRU((newSample: string) => {
//   const s = get(samples)[newSample];
//   if (!s) return;
//   if (!s.hydrated) s.hydrate().catch(console.error);
//   get(focus).sample = s
// });
// Update sample when sample is changed.

// Overlays and Features

export const annotating: Writable<{
  currKey: number;
  keys: string[];
  spots?: string;
  show: boolean;
}> = writable({
  currKey: -1,
  keys: [],
  show: true
});
