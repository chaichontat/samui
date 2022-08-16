import type { Image } from '$lib/data/image';
import { difference, intersection } from 'lodash-es';
import { Map, MapBrowserEvent, Overlay } from 'ol';
import ScaleLine from 'ol/control/ScaleLine.js';
import Zoom from 'ol/control/Zoom.js';

import { get } from 'svelte/store';
import type { OverlayData } from '../data/overlay';
import { sOverlay } from '../store';

import { Deferrable } from '../utils';
import { Background } from './background';
import type { MapComponent, OLLayer } from './definitions';
import { Draww } from './selector';
import { ActiveSpots, MutableSpots, WebGLSpots } from './spots';

export class Mapp extends Deferrable {
  map?: Map;
  layers: Record<string, MapComponent<OLLayer>>;
  persistentLayers: {
    background: Background;
    annotations: MutableSpots;
    active: ActiveSpots;
  };
  draw?: Draww;
  overlays?: Record<string, OverlayData>;
  image?: Image;
  tippy?: { overlay: Overlay; elem: HTMLElement };
  mounted = false;

  constructor() {
    super();
    this.layers = {};
    this.persistentLayers = {
      background: new Background('background'),
      active: new ActiveSpots('active', this),
      annotations: new MutableSpots('annotations', this)
    };
    this.persistentLayers.annotations.z = Infinity;
    this.draw = new Draww(this, this.persistentLayers.annotations);
  }

  mount(target: HTMLElement, tippyElem: HTMLElement) {
    // Mount components
    this.map = new Map({ target });
    Object.values(this.layers).map((l) => l.mount());
    Object.values(this.persistentLayers).map((l) => l.mount());
    this.draw!.mount(this.map);

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

    this._deferred.resolve();
    this.mounted = true;
  }

  async update({
    overlays,
    image,
    refresh
  }: {
    overlays: Record<string, OverlayData>;
    image?: Image;
    refresh?: boolean;
  }) {
    if (!this.mounted) throw new Error('Map not mounted.');
    const newOl = Object.keys(overlays);
    const currOl = Object.keys(this.layers);

    const toDelete = difference(currOl, newOl);
    toDelete.map((name) => this.layers[name].dispose());

    const toCreate = difference(newOl, currOl).map((name) => new WebGLSpots(name, this));
    toCreate.forEach((x) => x.mount());

    const newLayers = [
      ...toCreate,
      ...intersection(newOl, currOl).map((name) => this.layers[name])
    ];

    this.layers = {};
    for (const layer of newLayers) {
      this.layers[layer.name] = layer;
    }

    await Promise.all(Object.values(overlays).map((x) => x.hydrate()));
    newLayers.map((x) => x.update(overlays[x.name]));

    const imgPromise =
      !refresh && image ? this.persistentLayers.background.update(this.map!, image) : undefined;
    await imgPromise;
    this.image = image;
  }

  moveView({ x, y }: { x: number; y: number }, zoom?: number) {
    if (!this.map) throw new Error('Map not initialized.');
    if (!this.image) throw new Error('Image not initialized. Update never run.');

    const view = this.map.getView();
    const currZoom = view.getZoom();
    const mPerPx = this.image.mPerPx;

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

        const comp = this.layers[ol];
        const currLayer = comp.layer;
        if (!currLayer) throw new Error('No layer');

        if (this.map!.hasFeatureAtPixel(e.pixel)) {
          this.map!.getViewport().style.cursor = 'pointer';
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
