import { debounce } from 'lodash-es';
import { unByKey } from 'ol/Observable.js';
import type { EventsKey } from 'ol/events.js';
import { get } from 'svelte/store';
import type { FeatureAndGroup } from '../data/objects/feature';
import {
  mapIdSample,
  mapTiles,
  overlays,
  overlaysFeature,
  samples,
  sEvent,
  sMapId,
  sMapp,
  sOverlay,
  sSample,
  setHoverSelect
} from '../store';
import type { Mapp } from './mapp';

/** Viewer state that survives a page reload via the query string. */
export type ViewState = {
  /** Map center in image pixel coordinates (see {@link meterToPixel}). */
  center?: [number, number];
  zoom?: number;
  /** Active overlay's feature ("selected layer"). */
  feature?: FeatureAndGroup;
  /** Active sample name. */
  sample?: string;
};

const PARAM = {
  x: 'x',
  y: 'y',
  z: 'z',
  group: 'g',
  feature: 'f',
  sample: 'sample'
} as const;

// OpenLayers stores the center in projected meters. The app's pixel convention
// (see sPixel in store.ts and changeHover in mapp.svelte) negates the y axis.
export function meterToPixel(center: [number, number], mPerPx: number): [number, number] {
  return [center[0] / mPerPx, -center[1] / mPerPx];
}

export function pixelToMeter(px: [number, number], mPerPx: number): [number, number] {
  return [px[0] * mPerPx, -px[1] * mPerPx];
}

function numParam(p: URLSearchParams, key: string): number | undefined {
  const raw = p.get(key);
  if (raw === null || raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function parseViewState(search: string): ViewState {
  const p = new URLSearchParams(search);
  const state: ViewState = {};

  const x = numParam(p, PARAM.x);
  const y = numParam(p, PARAM.y);
  if (x !== undefined && y !== undefined) state.center = [x, y];

  const z = numParam(p, PARAM.z);
  if (z !== undefined) state.zoom = z;

  const group = p.get(PARAM.group);
  const feature = p.get(PARAM.feature);
  if (group && feature) state.feature = { group, feature };

  const sample = p.get(PARAM.sample);
  if (sample) state.sample = sample;

  return state;
}

function setOrDelete(p: URLSearchParams, key: string, value: string | undefined) {
  if (value === undefined) {
    p.delete(key);
  } else {
    p.set(key, value);
  }
}

/**
 * Merge {@link state} into the existing query string, preserving unrelated
 * params (notably the sample-loading `url`/`s` params).
 */
export function buildSearch(currentSearch: string, state: ViewState): string {
  const p = new URLSearchParams(currentSearch);

  setOrDelete(p, PARAM.x, state.center ? String(Math.round(state.center[0])) : undefined);
  setOrDelete(p, PARAM.y, state.center ? String(Math.round(state.center[1])) : undefined);
  setOrDelete(
    p,
    PARAM.z,
    state.zoom !== undefined ? String(Math.round(state.zoom * 100) / 100) : undefined
  );
  setOrDelete(p, PARAM.group, state.feature?.group);
  setOrDelete(p, PARAM.feature, state.feature?.feature);
  setOrDelete(p, PARAM.sample, state.sample);

  const s = p.toString();
  return s ? `?${s}` : '';
}

function effectiveMPerPx(map: Mapp): number | undefined {
  const ov = get(sOverlay);
  return map.mPerPx ?? (ov ? get(overlays)[ov]?.coords?.mPerPx : undefined);
}

function activeFeature(): FeatureAndGroup | undefined {
  const ov = get(sOverlay);
  return ov ? get(overlaysFeature)[ov] : undefined;
}

/** A single map tile is the supported case for URL sync (see {@link UrlStateController}). */
function singleTile(): boolean {
  return get(mapTiles).length <= 1;
}

/**
 * Two-way sync between the OpenLayers viewport and the URL query string.
 *
 * Restore order matters: the feature is applied on `sampleUpdated` (before the
 * final render) so the right overlay loads, while center/zoom are applied on
 * the first `renderComplete` (after `Mapp.updateSample` has fit the view).
 * Writes are suppressed until restore finishes to avoid clobbering the URL.
 *
 * Only single-map mode is synced; in split-view the URL is left untouched.
 */
export class UrlStateController {
  private pending: ViewState;
  private featureRestored = false;
  private sampleRestored = false;
  private viewRestored = false;
  private ready = false;
  private moveEndKey?: EventsKey;
  private unsubs: (() => void)[] = [];
  private write = debounce(() => this.flush(), 300);

  constructor(search: string) {
    this.pending = parseViewState(search);
  }

  start() {
    this.unsubs.push(sEvent.subscribe((e) => this.onEvent(e?.type)));

    // The layout mounts after the map (Svelte fires child onMount first), so the
    // first render events may already have passed. Restore against current state
    // if a view has been fit (its center is set once Mapp.updateSample runs).
    if (get(sMapp)?.map?.getView()?.getCenter()) {
      this.attemptRestore();
      this.attachMoveEnd();
      this.ready = true;
    }
  }

  stop() {
    this.write.cancel();
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    if (this.moveEndKey) unByKey(this.moveEndKey);
    this.moveEndKey = undefined;
  }

  private onEvent(type?: string) {
    if (type === 'sampleUpdated' || type === 'renderComplete') {
      this.attemptRestore();
      this.attachMoveEnd();
    }

    // The map has painted; further waiting is pointless. Open the write gate so
    // user pans/zooms are recorded even if some state could not be restored.
    if (type === 'renderComplete') this.ready = true;

    if (this.ready && (type === 'featureUpdated' || type === 'sampleUpdated')) this.write();
  }

  private attemptRestore() {
    this.restoreSample();
    this.restoreFeature();
    this.restoreView();
    // Nothing left to restore -> begin tracking user changes immediately.
    const needFeature = !!this.pending.feature && !this.featureRestored;
    const needView =
      (!!this.pending.center || this.pending.zoom !== undefined) && !this.viewRestored;
    if (!needFeature && !needView) this.ready = true;
  }

  private restoreSample() {
    if (this.sampleRestored || !this.pending.sample) return;
    this.sampleRestored = true;
    if (get(sSample)?.name === this.pending.sample) return;
    if (get(samples).some((s) => s.name === this.pending.sample)) {
      mapIdSample.update((m) => ({ ...m, [get(sMapId)]: this.pending.sample! }));
    }
  }

  private restoreFeature() {
    if (this.featureRestored || !this.pending.feature) return;
    this.featureRestored = true;
    setHoverSelect({ selected: this.pending.feature }).catch(console.error);
  }

  private restoreView() {
    if (this.viewRestored) return;
    const wantCenter = !!this.pending.center;
    const wantZoom = this.pending.zoom !== undefined;
    if (!wantCenter && !wantZoom) return;

    const view = get(sMapp)?.map?.getView();
    if (!view) return; // Map not mounted yet; retry on the next event.

    let applied = false;
    if (wantCenter) {
      const mPerPx = effectiveMPerPx(get(sMapp)!);
      if (!mPerPx) return; // Scale not known yet; retry without latching.
      view.setCenter(pixelToMeter(this.pending.center!, mPerPx));
      applied = true;
    }
    if (wantZoom) {
      view.setZoom(this.pending.zoom!);
      applied = true;
    }
    if (applied) this.viewRestored = true;
  }

  private attachMoveEnd() {
    if (this.moveEndKey) return;
    const map = get(sMapp);
    if (!map?.map) return;
    this.moveEndKey = map.map.on('moveend', () => {
      if (this.ready) this.write();
    });
  }

  private flush() {
    if (!singleTile()) return;

    const map = get(sMapp);
    const view = map?.map?.getView();
    if (!map || !view) return;

    const state: ViewState = {};

    const center = view.getCenter();
    const mPerPx = effectiveMPerPx(map);
    if (center && mPerPx) state.center = meterToPixel(center as [number, number], mPerPx);

    const zoom = view.getZoom();
    if (zoom !== undefined) state.zoom = zoom;

    state.feature = activeFeature();

    // Only disambiguate the sample when more than one is loaded.
    const sample = get(sSample)?.name;
    if (sample && get(samples).length > 1) state.sample = sample;

    const search = buildSearch(window.location.search, state);
    const url = `${window.location.pathname}${search}${window.location.hash}`;
    history.replaceState(history.state, '', url);
  }
}
