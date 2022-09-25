import type { Mapp } from '$src/lib/ui/mapp';
import { debounce } from 'lodash-es';
import { get, writable, type Writable } from 'svelte/store';
import type { FeatureAndGroup } from './data/objects/feature';
import type { Sample } from './data/objects/sample';
import { oneLRU } from './lru';
import { HoverSelect } from './sidebar/searchBox';
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
export const overlaysFeature = writable({} as Record<string, FeatureAndGroup | undefined>);
export const sFeatureData = writable(undefined as { name: FeatureAndGroup } | undefined);

export const annotating = writable({
  currKey: null as number | null,
  keys: [] as string[],
  show: true,
  selecting: false
});

type SimpleHS<T> = { hover?: T; selected?: T };
export const hoverSelect = writable(new HoverSelect<FeatureAndGroup>());
const _setHoverNow = (v: SimpleHS<FeatureAndGroup>) => hoverSelect.set(get(hoverSelect).update(v));
const _setHover = debounce(_setHoverNow, 50);

export const setHoverSelect = oneLRU((v: SimpleHS<FeatureAndGroup>) => {
  _setHover(v);
  if (v.selected) {
    // Prevents hover from overriding actual selected.
    _setHover.flush();
    _setHoverNow(v);
  }
});

export const sEvent = writable(undefined as Event | undefined);
sEvent.subscribe(console.debug);

export type Idx = { id?: number | string | null; idx: number; source: string };
export const sId = writable({ idx: -1, source: 'scatter' } as Idx);
