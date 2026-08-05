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

type SampleEntry = { name: string; sample: Sample };

function createSamplesStore(): Writable<SampleEntry[]> {
  let current: SampleEntry[] = [];
  const base = writable<SampleEntry[]>(current);

  const set = (next: SampleEntry[]) => {
    const retained = new Set(next.map((entry) => entry.sample));
    for (const entry of current) {
      if (!retained.has(entry.sample)) {
        entry.sample.dispose();
      }
    }

    current = next;
    base.set(next);
  };

  return {
    subscribe: base.subscribe,
    set,
    update: (updater) => set(updater(current))
  };
}

export const samples = createSamplesStore();

export const sMapp: Writable<Mapp | undefined> = writable(undefined);
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
  selecting: undefined as Geometries | undefined,
  ready: true
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
  reverseKeys: {} as Record<string, number>,
  ready: false
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
const _setHover = debounce((v: SimpleHS<FeatureAndGroup>, isCurrent: () => boolean) => {
  if (isCurrent()) _setHoverNow(v);
}, 50);

export const setHoverSelectIfCurrent = oneLRU(
  async (v: SimpleHS<FeatureAndGroup>, isCurrent: () => boolean) => {
    if (!isCurrent()) return false;
    if (v.selected && get(annoFeat).annotating?.overlay === get(sOverlay)) {
      const sample = get(sSample);
      if (!sample) return false;
      const feat = await sample.getFeature(v.selected);
      if (!isCurrent()) return false;
      if (feat?.coords.name !== get(annoFeat).annotating?.coordName) {
        alert(
          `You cannot change this layer's feature while annotating points from this layer. To see other features while annotating, add a new layer or change the active layer.`
        );
        return false;
      }
    }

    if (!isCurrent()) return false;
    _setHover(v, isCurrent);
    if (v.selected) {
      // Prevents hover from overriding actual selected.
      _setHover.flush();
      if (!isCurrent()) return false;
      _setHoverNow(v);
    }
    return true;
  }
);

const alwaysCurrent = () => true;

/** Update hover selection from UI callbacks that are not owned by an async map update. */
export const setHoverSelect = async (v: SimpleHS<FeatureAndGroup>): Promise<void> => {
  await setHoverSelectIfCurrent(v, alwaysCurrent);
};

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
          | 'imgDefaultsUpdated'
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
