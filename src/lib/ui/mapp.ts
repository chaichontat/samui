import type { CoordsData } from '$src/lib/data/objects/coords';
import type { Sample } from '$src/lib/data/objects/sample';
import { Deferrable } from '$src/lib/definitions';
import { Draww } from '$src/lib/sidebar/annotation/annROI';
import { Background } from '$src/lib/ui/background/imgBackground';
import { ActiveSpots, WebGLSpots } from '$src/lib/ui/overlays/points';
import { throttle } from 'lodash-es';
import { Map, MapBrowserEvent, Overlay, View } from 'ol';
import type { FeatureLike } from 'ol/Feature';
import ScaleLine from 'ol/control/ScaleLine.js';
import Zoom from 'ol/control/Zoom.js';
import type { Layer } from 'ol/layer';
import { get } from 'svelte/store';
import { DrawFeature } from '../sidebar/annotation/annFeat';
import { MutableSpots } from '../sidebar/annotation/mutableSpots';
import {
  annoFeat,
  annoROI,
  mapTiles,
  overlays,
  sEvent,
  sMapp,
  sOverlay,
  sPixel,
  setHoverSelectIfCurrent
} from '../store';

type Listener = (
  obj: { idx: number; id: number | string; feature: FeatureLike } | null,
  ev?: MapBrowserEvent<UIEvent>
) => void;

export function buildMapResolutions(resolutions: number[]) {
  const sourceResolutions = resolutions.filter((value) => Number.isFinite(value) && value > 0);

  if (sourceResolutions.length === 0) {
    throw new Error('GeoTIFF source returned no valid resolutions.');
  }

  if (sourceResolutions.length === 1) {
    const native = sourceResolutions[0];
    return [native * 128, native * 2, native, native / 2, native / 4];
  }

  const base = sourceResolutions.slice(0, -1);
  const native = base.at(-1)! / 4;
  return [native * 128, ...base, native * 2, native, native / 2, native / 4];
}

export class Mapp extends Deferrable {
  map?: Map;
  scaleLine?: ScaleLine;
  persistentLayers: {
    background: Background;
    active: ActiveSpots;
    annotations: DrawFeature;
    rois: Draww;
  };
  overlays?: Record<string, CoordsData>;
  tippy?: { overlay: Overlay; elem: HTMLElement };
  mounted = false;
  _needNewView = true;
  private destroyed = false;
  private updateGeneration = 0;
  private resizeTimeout?: ReturnType<typeof setTimeout>;

  get isDestroyed() {
    return this.destroyed;
  }

  get isActive() {
    return get(sMapp) === this;
  }

  listeners = { pointermove: [], click: [] } as {
    pointermove: { f: Listener; layer?: Layer }[];
    click: { f: Listener; layer?: Layer }[];
  };
  lastHover: FeatureLike | null = null;

  constructor() {
    super();
    // this.layers = {};
    this.persistentLayers = {
      background: new Background(),
      active: new ActiveSpots(this),
      annotations: new DrawFeature(this, annoFeat, new MutableSpots(this)),
      rois: new Draww(this, annoROI)
    };
  }

  mount(target: HTMLElement, tippyElem: HTMLElement) {
    if (this.destroyed) throw new Error('Cannot remount a destroyed map.');

    // Mount components
    this.map = new Map({ target });
    Object.values(this.persistentLayers).map((l) => l.mount());

    // Move controls
    this.map.removeControl(this.map.getControls().getArray()[0]);
    this.map.addControl(new Zoom({ delta: 0.4 }));
    this.scaleLine = new ScaleLine({ text: true, minWidth: 140 });
    this.syncScaleLineVisibility();

    this.map.on('pointermove', (e) => this.runPointerListener(e));
    this.map.on('click', (e) => this.runPointerListener(e));

    // this.map.on('movestart', () => (this.map!.getViewport().style.cursor = 'grabbing'));
    // this.map.on('moveend', () => (this.map!.getViewport().style.cursor = 'grab'));

    this.tippy = {
      overlay: new Overlay({
        element: tippyElem,
        positioning: 'top-center',
        offset: [0, 16],
        stopEvent: false
      }),
      elem: tippyElem
    };
    this.map.addOverlay(this.tippy.overlay);

    // Create first overlay. Prevents spontaneous overlay when splitting.
    if (get(mapTiles).length === 1 && Object.keys(get(overlays)).length === 0) {
      const ol = new WebGLSpots(this);
      overlays.set({ [ol.uid]: ol });
      sOverlay.set(ol.uid);
    }

    this._deferred.resolve();
    // Deals with sidebar showing up or not.
    this.resizeTimeout = setTimeout(() => this.map?.updateSize(), 100);
    this.mounted = true;
  }

  /** Dispose this map's resources and invalidate pending work without disturbing sibling maps. */
  unmount() {
    if (this.destroyed) return;

    this.destroyed = true;
    this.mounted = false;
    this.updateGeneration += 1;
    if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
    this.resizeTimeout = undefined;
    this.setCurrPixel.cancel();
    this.runPointerListener.cancel();

    const map = this.map;
    const currentOverlays = get(overlays);
    const ownedOverlayIds = Object.entries(currentOverlays)
      .filter(([, overlay]) => overlay.map === this)
      .map(([uid]) => uid);
    if (ownedOverlayIds.length > 0) {
      const owned = new Set(ownedOverlayIds);
      for (const uid of ownedOverlayIds) currentOverlays[uid].dispose();
      const remaining = Object.fromEntries(
        Object.entries(currentOverlays).filter(([uid]) => !owned.has(uid))
      );
      overlays.set(remaining);
      const selectedOverlay = get(sOverlay);
      if (selectedOverlay && owned.has(selectedOverlay)) {
        sOverlay.set(Object.keys(remaining)[0]);
      }
    }

    this.persistentLayers.background.dispose(map);
    this.persistentLayers.active.dispose();
    this.persistentLayers.annotations.dispose();
    this.persistentLayers.rois.dispose();
    this.listeners.pointermove = [];
    this.listeners.click = [];
    map?.dispose();
    this.map = undefined;
    this.scaleLine = undefined;
    this.tippy = undefined;
  }

  private isCurrentUpdate(generation: number, map: Map) {
    return (
      this.isActive &&
      this.mounted &&
      !this.destroyed &&
      this.updateGeneration === generation &&
      this.map === map
    );
  }

  /** Return false when a newer update or teardown supersedes this sample load. */
  async updateSample(sample: Sample): Promise<boolean> {
    const generation = ++this.updateGeneration;
    await this.promise;
    const map = this.map;
    if (!map || !this.isCurrentUpdate(generation, map)) return false;

    await sample.hydrate();
    if (!this.isCurrentUpdate(generation, map)) return false;

    // Image
    // TODO: Persistent view when returning to same sample.
    const image = sample.image;
    const bg = this.persistentLayers.background;
    const promises = [];
    bg.image = image; // Necessary to mark image as non-existent.
    map.once('rendercomplete', () => {
      if (this.isCurrentUpdate(generation, map)) sEvent.set({ type: 'renderComplete' });
    });
    if (image) {
      const updated = await bg.update(map, image, () => this.isCurrentUpdate(generation, map));
      if (!updated) return false;
      this.syncScaleLineVisibility();
      if (bg.viewOptions) {
        const view = new View(bg.viewOptions);
        map.setView(view);
        view.fit(bg.viewOptions.extent!, {
          maxZoom: Math.max(
            2,
            bg.viewOptions.resolutions!.findIndex((resolution) => resolution === image.mPerPx)
          )
        });
        this._needNewView = false;
      } else {
        promises.push(
          bg
            .geoTiffSource!.getView()
            .then((v) => {
              return new View({
                ...v,
                // Fill in the missing 1/2x resolution and extend to 4x magnification over native.
                // Also add another layer of zoom out.
                resolutions: buildMapResolutions(v.resolutions ?? [])
              });
            })
            .then((v) => {
              if (!this.isCurrentUpdate(generation, map)) return;
              map.setView(v);
              this._needNewView = false;
            })
            .catch((error) => {
              if (this.isCurrentUpdate(generation, map)) console.error(error);
            })
        );
      }
    } else {
      console.debug('No image. View must come from overlay.');
      this.persistentLayers.background.dispose(map);
      bg.mPerPx = undefined;
      this.syncScaleLineVisibility();
      this._needNewView = true;
    }

    // Overlays
    this.persistentLayers.active.visible = false;

    await Promise.all([
      ...promises,
      ...Object.values(get(overlays))
        .filter((overlay) => overlay.map === this)
        .map((overlay) => overlay.updateSample(sample, () => this.isCurrentUpdate(generation, map)))
    ]);
    if (!this.isCurrentUpdate(generation, map)) return false;

    if (sample.featureParams) {
      // Must have an active feature, otherwise renderComplete will not fire.
      const selected = get(overlays)[get(sOverlay)]?.currFeature ??
        sample.overlayParams?.defaults?.[0] ?? {
          group: sample.features[Object.keys(sample.features)[0]].name,
          feature: sample.features[Object.keys(sample.features)[0]].featNames[0]
        };

      console.log('Selected', selected);
      if (!this.isCurrentUpdate(generation, map)) return false;
      await setHoverSelectIfCurrent({ selected }, () =>
        this.isCurrentUpdate(generation, map)
      ).catch((error) => {
        if (this.isCurrentUpdate(generation, map)) console.error(error);
      });
      if (!this.isCurrentUpdate(generation, map)) return false;
    }
    sEvent.set({ type: 'sampleUpdated' });
    return true;
  }

  get mPerPx() {
    return this.persistentLayers.background?.mPerPx;
  }

  private syncScaleLineVisibility() {
    if (!this.map || !this.scaleLine) return;

    const shouldShow =
      this.mPerPx != undefined &&
      this.persistentLayers.background.image?.hasPhysicalScale !== false;
    const isAttached = this.scaleLine.getMap() === this.map;

    if (shouldShow && !isAttached) {
      this.map.addControl(this.scaleLine);
    } else if (!shouldShow && isAttached) {
      this.map.removeControl(this.scaleLine);
    }
  }

  moveView({ x, y }: { x: number; y: number }, zoom?: number) {
    if (!this.map) throw new Error('Map not initialized.');

    const view = this.map.getView();
    const currZoom = view.getZoom();
    const mPerPx = this.mPerPx;

    if (currZoom && currZoom > 2) {
      view.animate({ center: [x * mPerPx, y * mPerPx], duration: 100, zoom: zoom ?? currZoom });
    }
  }

  setCurrPixel = throttle((meter: [number, number]) => {
    if (this.isActive && this.mPerPx) {
      sPixel.set([meter[0] / this.mPerPx, -meter[1] / this.mPerPx]);
    }
  });

  runPointerListener = throttle((e: MapBrowserEvent<UIEvent>) => {
    if (!this.isActive) return;

    // Outlines take precedence. Either visible is fine.
    if (e.type === 'pointermove') {
      this.setCurrPixel(e.coordinate as [number, number]);
      // Don't run if dragging.
      if ((e.originalEvent as PointerEvent).pressure) return;
    }

    const currLayer = get(overlays)[get(sOverlay)]?.layer;
    const eType = e.type as 'pointermove' | 'click';
    const listeners = this.listeners[eType];
    const alerted = new Array(listeners.length).fill(false);

    // feature is overlay in our parlance.
    this.map!.forEachFeatureAtPixel(e.pixel, (f, evLayer) => {
      const idx = f.getId() as number | undefined;
      const id = f.get('id') as number | string;

      listeners.forEach(({ f: g, layer: targetLayer }, i) => {
        if (evLayer === (targetLayer ?? currLayer)) {
          // Features in important layers always have a number id.
          if (idx == undefined) {
            console.error("Overlay doesn't have an id.");
          } else {
            g(idx == undefined ? null : { idx, id, feature: f }, e);
            alerted[i] = true;
          }
        }

        // Terminate search when all listeners have been alerted.
        if (alerted.every((a) => a)) return true;
      });

      if (eType === 'pointermove') {
        listeners.forEach(({ f: g }, i) => {
          if (!alerted[i]) g(null, e);
        });
      }
    });
  }, 10);

  // Handle all clicks and hovers on the map.
  attachPointerListener(
    { pointermove, click }: { pointermove?: Listener; click?: Listener },
    { layer }: { layer?: Layer } = {}
  ) {
    if (pointermove) this.listeners.pointermove.push({ f: pointermove, layer });
    if (click) this.listeners.click.push({ f: click, layer });
  }
}
