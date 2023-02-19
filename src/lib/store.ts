import { browser } from '$app/environment';
import type { Mapp } from '$src/lib/ui/mapp';
import { debounce } from 'lodash-es';
import { get, writable, type Writable } from 'svelte/store';
import type { FeatureAndGroup } from './data/objects/feature';
import type { Sample } from './data/objects/sample';
import { oneLRU } from './lru';
import type { Geometries } from './sidebar/annotation/annROI';
import { HoverSelect, type FeatureGroupList } from './sidebar/searchBox';
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
export const allFeatures = writable(undefined as FeatureGroupList[] | undefined);

export const sFeatureData = writable(
  undefined as Awaited<ReturnType<Sample['getFeature']>> | undefined
);
export const sPixel = writable(undefined as [number, number] | undefined);

export const annoROI = writable({
  currKey: undefined as number | undefined,
  keys: [] as string[],
  show: true,
  selecting: undefined as Geometries | undefined
});

const escHandlerRoi = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    annoROI.update((a) => ({ ...a, selecting: undefined }));
  }
};

annoROI.subscribe((ann) => {
  if (browser) {
    if (ann.selecting) {
      document.body.style.cursor = 'crosshair';
      document.addEventListener('keydown', escHandlerRoi);
    } else {
      document.body.style.cursor = 'default';
      document.removeEventListener('keydown', escHandlerRoi);
    }
  }
});

export const annoHover = writable(undefined as number | undefined);
export const annoFeat = writable({
  currKey: undefined as number | undefined,
  keys: [] as string[],
  show: true,
  annotating: undefined as { coordName: string; overlay: string } | undefined,
  selecting: undefined as Geometries | 'Select' | undefined,
  reverseKeys: {} as Record<string, number>
});

annoFeat.subscribe((ann) => {
  // DO NOT reassign reverseKeys. It's a reference for mutspot.
  ann.keys.forEach((k, i) => (ann.reverseKeys[k] = i));
});

const escHandler = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    annoFeat.update((a) => ({ ...a, selecting: undefined }));
  }
};

annoFeat.subscribe((ann) => {
  if (browser) {
    if (ann.selecting) {
      document.body.style.cursor = 'crosshair';
      document.addEventListener('keydown', escHandler);
    } else {
      document.body.style.cursor = 'default';
      document.removeEventListener('keydown', escHandler);
    }
  }
});

export type SimpleHS<T> = { hover?: T; selected?: T };
export const hoverSelect = writable(new HoverSelect<FeatureAndGroup>());
const _setHoverNow = (v: SimpleHS<FeatureAndGroup>) => hoverSelect.set(get(hoverSelect).update(v));
const _setHover = debounce(_setHoverNow, 50);

export const setHoverSelect = oneLRU(async (v: SimpleHS<FeatureAndGroup>) => {
  if (v.selected && get(annoFeat).annotating?.overlay === get(sOverlay)) {
    const feat = await get(sSample).getFeature(v.selected);
    if (feat?.coords.name !== get(annoFeat).annotating?.coordName) {
      alert(
        `You cannot change this layer's feature while annotating points from this layer. To see other features while annotating, add a new layer or change the active layer.`
      );
      return;
    }
  }

  _setHover(v);
  if (v.selected) {
    // Prevents hover from overriding actual selected.
    _setHover.flush();
    _setHoverNow(v);
  }
});

export const sEvent = writable(
  undefined as
    | {
        type:
          | 'sampleUpdated'
          | 'featureUpdated'
          | 'pointsAdded'
          | 'viewAdjusted'
          | 'maskUpdated'
          | 'overlayAdjusted'
          | 'renderComplete';
      }
    | undefined
);
sEvent.subscribe(console.debug);

export type Idx = { id?: number | string; idx?: number; source: string };
export const sId = writable({ source: 'map' } as Idx);

export const isOnline = writable(false);
export const userState = writable({
  showImgControl: true
});

export const mask = writable(undefined as boolean[] | undefined);

export const flashing = writable('');
