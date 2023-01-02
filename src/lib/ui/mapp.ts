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

type Listener = (
  obj: { idx: number; id: number | string; feature: FeatureLike } | null,
  ev?: MapBrowserEvent<UIEvent>
) => void;

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
            console.log('View', v);
            // Need this because the first tile is 1/4th the resolution of native,
            // whereas others are 1/2 the resolution of the next tile.
            const b = v.resolutions!.slice(0, -1);
            const native = b.at(-1)! / 4;
            return new View({
              ...v,
              resolutions: [native * 128, ...b, native * 2, native, native / 2, native / 4]
            });
          })
          .then((v) => {
            this.map!.setView(v);
            this._needNewView = false;
          })
          .catch(console.error)
      );
    } else {
      console.debug('No image. View must come from overlay.');
      this.persistentLayers.background.dispose(this.map);
      this._needNewView = true;
    }

    // Overlays
    this.persistentLayers.active.visible = false;

    await Promise.all([
      ...promises,
      ...Object.values(get(overlays)).map((ol) => ol.updateSample(sample))
    ]);

    if (sample.featureParams) {
      // Must have an active feature, otherwise renderComplete will not fire.
      const selected = get(overlays)[get(sOverlay)]?.currFeature ??
        sample.overlayParams?.defaults?.[0] ?? {
          group: sample.features[Object.keys(sample.features)[0]].name,
          feature: sample.features[Object.keys(sample.features)[0]].featNames[0]
        };

      console.log('Selected', selected);
      setHoverSelect({ selected }).catch(console.error);
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
