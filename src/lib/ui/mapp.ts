import { Map, MapBrowserEvent, Overlay, View } from 'ol';
import ScaleLine from 'ol/control/ScaleLine.js';
import Zoom from 'ol/control/Zoom.js';

import { get } from 'svelte/store';

import type { CoordsData } from '$src/lib/data/objects/coords';
import type { Sample } from '$src/lib/data/objects/sample';
import { Deferrable } from '$src/lib/definitions';
import { Background } from '$src/lib/ui/background/imgBackground';
import { ActiveSpots, WebGLSpots } from '$src/lib/ui/overlays/points';
import { mapTiles, overlays, overlaysFeature, setHoverSelect, sEvent, sOverlay } from '../store';

export class Mapp extends Deferrable {
  map?: Map;
  // layers: Record<string, MapComponent<OLLayer>>;
  persistentLayers: {
    background: Background;
    active: ActiveSpots;
    // annotations: MutableSpots;
  };
  // draw?: Draww;
  overlays?: Record<string, CoordsData>;
  tippy?: { overlay: Overlay; elem: HTMLElement };
  mounted = false;
  mPerPx?: number;
  _needNewView = true;

  constructor() {
    super();
    // this.layers = {};
    this.persistentLayers = {
      background: new Background(),
      active: new ActiveSpots(this)
      // annotations: new MutableSpots(this)
    };
    // this.persistentLayers.annotations.z = Infinity;
    // this.draw = new Draww(this, this.persistentLayers.annotations);
  }

  mount(target: HTMLElement, tippyElem: HTMLElement) {
    // Mount components
    this.map = new Map({ target });
    // Object.values(this.layers).map((l) => l.mount());
    Object.values(this.persistentLayers).map((l) => l.mount());
    // this.draw!.mount(this.map);

    // Move controls
    this.map.removeControl(this.map.getControls().getArray()[0]);
    this.map.addControl(new Zoom({ delta: 0.4 }));
    this.map.addControl(new ScaleLine({ text: true, minWidth: 140 }));

    this.map.on('movestart', () => (this.map!.getViewport().style.cursor = 'grabbing'));
    this.map.on('moveend', () => (this.map!.getViewport().style.cursor = 'grab'));

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
    if (get(mapTiles).length === 1) {
      const ol = new WebGLSpots(this);
      overlays.set({ [ol.uid]: ol });
      sOverlay.set(ol.uid);
    }

    this._deferred.resolve();
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
      setHoverSelect({ selected: sample.overlayParams.defaults[0] });
    }
    sEvent.set(new Event('updatedSample'));
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

  // Handle all clicks and hovers on the map.
  attachPointerListener(funs: {
    pointermove?: (
      obj: { idx: number; id: number | string } | null,
      ev?: MapBrowserEvent<UIEvent>
    ) => void;
    click?: (obj: { idx: number; id: number | string } | null) => void;
  }) {
    for (const [k, v] of Object.entries(funs)) {
      this.map!.on(k as 'pointermove' | 'click', (e) => {
        // Outlines take precedence. Either visible is fine.
        const ol = get(sOverlay);
        if (!ol) return;
        const comp = get(overlays)[ol];
        const currLayer = comp.layer;
        if (!currLayer) {
          console.error('No layer');
          return;
        }
        if (this.map!.hasFeatureAtPixel(e.pixel)) {
          this.map!.getViewport().style.cursor = 'auto';
          // feature is overlay in our parlance.
          this.map!.forEachFeatureAtPixel(
            e.pixel,
            (f) => {
              const idx = f.getId() as number | undefined;
              const id = f.get('id') as number | string;
              if (idx === undefined) {
                // 0 is falsy.
                console.error("Overlay doesn't have an id.");
                return true;
              }
              v({ idx, id }, e);
              return true; // Terminates search.
            },
            {
              layerFilter: (layer) => layer === currLayer, // Ignore active spot.
              hitTolerance: 20
            }
          );
        } else {
          this.map!.getViewport().style.cursor = 'grab';
          v(null, e);
        }
      });
    }
  }
}