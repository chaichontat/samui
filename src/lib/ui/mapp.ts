import type { CoordsData } from '$src/lib/data/objects/coords';
import type { Sample } from '$src/lib/data/objects/sample';
import { Deferrable } from '$src/lib/definitions';
import { Draww } from '$src/lib/sidebar/annotation/annROI';
import { Background } from '$src/lib/ui/background/imgBackground';
import { ActiveSpots, WebGLSpots } from '$src/lib/ui/overlays/points';
import { throttle } from 'lodash-es';
import { Map, MapBrowserEvent, Overlay, View } from 'ol';
import ScaleLine from 'ol/control/ScaleLine.js';
import Zoom from 'ol/control/Zoom.js';
import type { FeatureLike } from 'ol/Feature';
import type { Layer } from 'ol/layer';
import { get } from 'svelte/store';
import { DrawFeature } from '../sidebar/annotation/annFeat';
import { MutableSpots } from '../sidebar/annotation/mutableSpots';
import {
  annoFeat,
  annoROI,
  mapTiles,
  overlays,
  setHoverSelect,
  sEvent,
  sOverlay,
  sPixel
} from '../store';

export class Mapp extends Deferrable {
  map?: Map;
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

  listeners: { pointermove: []; click: [] } = { pointermove: [], click: [] };
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
    // Mount components
    this.map = new Map({ target });
    Object.values(this.persistentLayers).map((l) => l.mount());

    // Move controls
    this.map.removeControl(this.map.getControls().getArray()[0]);
    this.map.addControl(new Zoom({ delta: 0.4 }));
    this.map.addControl(new ScaleLine({ text: true, minWidth: 140 }));

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
    setTimeout(() => this.map!.updateSize(), 100);
    this.mounted = true;
  }

  async updateSample(sample: Sample) {
    if (!this.map) throw new Error('Map not mounted.');
    await sample.hydrate();

    // Image
    // TODO: Persistent view when returning to same sample.
    const image = sample.image;
    const bg = this.persistentLayers.background;
    const promises = [];
    bg.image = image; // Necessary to mark image as non-existent.
    this.map.once('rendercomplete', () => sEvent.set({ type: 'renderComplete' }));
    if (image) {
      await bg.update(this.map, image);
      promises.push(
        bg
          .source!.getView()
          .then((v) => {
            return new View({
              ...v,
              resolutions: [
                ...v.resolutions!,
                v.resolutions!.at(-1)! / 2,
                v.resolutions!.at(-1)! / 4
              ]
            });
          })
          .then((v) => {
            this.map!.setView(v);
            this._needNewView = false;
          })
          .catch(console.error)
      );
    } else {
      this.persistentLayers.background.dispose(this.map);
      // No image. View must come from overlay.
      this._needNewView = true;
    }

    // Overlays
    this.persistentLayers.active.visible = false;

    await Promise.all([
      ...promises,
      ...Object.values(get(overlays)).map((ol) => ol.updateSample(sample))
    ]);

    // Defaults
    if (sample.overlayParams?.defaults && !get(overlays)[get(sOverlay)]?.currFeature) {
      setHoverSelect({ selected: sample.overlayParams.defaults[0] }).catch(console.error);
    }
    sEvent.set({ type: 'sampleUpdated' });
  }

  get mPerPx() {
    return this.persistentLayers.background?.mPerPx;
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
    if (this.mPerPx) {
      sPixel.set([meter[0] / this.mPerPx, -meter[1] / this.mPerPx]);
    }
  });

  runPointerListener = throttle((e: MapBrowserEvent<UIEvent>) => {
    // Outlines take precedence. Either visible is fine.
    this.setCurrPixel(e.coordinate as [number, number]);
    // Don't run if dragging.
    if ((e.originalEvent as PointerEvent).pressure) return;

    let hasPixel = false;
    const currLayer = get(overlays)[get(sOverlay)]?.layer;

    // feature is overlay in our parlance.
    this.map!.forEachFeatureAtPixel(e.pixel, (f, layer) => {
      const idx = f.getId() as number | undefined;
      const id = f.get('id') as number | string;
      if (layer === currLayer) {
        if (idx == undefined) {
          console.error("Overlay doesn't have an id.");
          return true;
        }
        hasPixel = true;
        this.listeners[e.type as 'pointermove' | 'click'].forEach((g) => g({ idx, id, f }, e));
        return true;
      }
    });

    if (!hasPixel) {
      this.listeners[e.type as 'pointermove' | 'click'].forEach((g) => g(null, e));
    }
  }, 10);

  // Handle all clicks and hovers on the map.
  attachPointerListener(
    funs: {
      pointermove?: (
        obj: { idx: number; id: number | string; f: FeatureLike } | null,
        ev?: MapBrowserEvent<UIEvent>
      ) => void;
      click?: (obj: { idx: number; id: number | string; f: FeatureLike } | null) => void;
    },
    { layer }: { layer?: Layer } = {} // TODO: hover roi label
  ) {
    const { pointermove, click } = funs;
    if (pointermove) this.listeners.pointermove.push(pointermove);
    if (click) this.listeners.click.push(click);
  }
}
