import type { Mapp } from '$src/lib/ui/mapp';
import { writable, type Writable } from 'svelte/store';
import type { FeatureAndGroup } from './data/objects/feature';
import type { Sample } from './data/objects/sample';
import type { WebGLSpots } from './ui/overlays/points';

export const samples: Writable<Record<string, Sample>> = writable({});

export const sMapp = writable(undefined as Mapp | undefined);

export const sMapId: Writable<number> = writable(0);
export const mapTiles: Writable<number[]> = writable([0]);
export const mapIdSample: Writable<Record<number, string>> = writable({});

// Updated in store.svelte.
export const sSample = writable(undefined as Sample | undefined);

export const overlays: Writable<Record<string, WebGLSpots>> = writable({});
/// Overlay -> Group/feature
export const sOverlay = writable(undefined as string | undefined);
export const sFeature = writable({} as Record<string, FeatureAndGroup | undefined>);

export const annotating = writable({
  currKey: null as number | null,
  keys: [] as string[],
  show: true,
  selecting: false
});
