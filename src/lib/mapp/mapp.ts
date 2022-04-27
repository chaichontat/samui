import type { Image } from '$lib/data/image';
import { Map } from 'ol';
import ScaleLine from 'ol/control/ScaleLine.js';
import Zoom from 'ol/control/Zoom.js';
import type { Geometry, Point } from 'ol/geom';
import type { Layer } from 'ol/layer';
import type WebGLPointsLayer from 'ol/layer/WebGLPoints';
import type GeoTIFFSource from 'ol/source/GeoTIFF';
import type VectorSource from 'ol/source/Vector';
import { Deferrable } from '../utils';
import { Background } from './background';
import { Draww } from './selector';
import { ActiveSpots, WebGLSpots } from './spots';

export interface MapComponent extends Deferrable {
  readonly source?: VectorSource<Geometry> | GeoTIFFSource;
  readonly layer?: Layer | WebGLPointsLayer<VectorSource<Point>>;
  update(...args: unknown[]): void;
  mount(...args: unknown[]): void;
}

export class Mapp extends Deferrable {
  map?: Map;
  readonly layers: MapComponent[];
  readonly layerMap: { background: Background; spots: WebGLSpots; active: ActiveSpots };
  draw?: Draww;
  image?: Image;

  mounted = false;

  constructor() {
    super();
    this.layerMap = {
      background: new Background(),
      spots: new WebGLSpots(),
      active: new ActiveSpots()
    };

    this.layers = [this.layerMap.background, this.layerMap.spots, this.layerMap.active];
  }

  mount() {
    this.layers.map((l) => l.mount());

    this.map = new Map({
      target: 'map',
      layers: this.layers.map((l) => l.layer!)
    });
    if (!this.map) throw new Error('Map not initialized.');

    this.map.removeControl(this.map.getControls().getArray()[0]);
    this.map.addControl(new Zoom({ delta: 0.4 }));
    this.map.addControl(new ScaleLine({ text: true, minWidth: 140 }));

    this.draw = new Draww(this.map);

    this.map.on('movestart', () => (this.map!.getViewport().style.cursor = 'grabbing'));
    this.map.on('moveend', () => (this.map!.getViewport().style.cursor = 'grab'));

    this._deferred.resolve();
    this.mounted = true;
  }

  async update({ image }: { image: Image }) {
    await this.promise;
    await image.promise;
    await Promise.all([
      this.layerMap.background.update(this.map!, image),
      this.layerMap.spots.update(
        this.map!,
        image.coords!,
        image.header!.spot.spotDiam,
        image.header!.spot.mPerPx
      )
    ]);
    this.draw!.update(this.layerMap.spots.source.getFeatures());
    this.image = image;
  }

  moveView({ x, y }: { x: number; y: number }, zoom?: number) {
    if (!this.map) throw new Error('Map not initialized.');
    if (!this.image) throw new Error('Image not initialized. Update never run.');

    const view = this.map.getView();
    const currZoom = view.getZoom();
    const mPerPx = this.image.header!.spot.mPerPx;

    if (currZoom && currZoom > 2) {
      view.animate({ center: [x * mPerPx, y * mPerPx], duration: 100, zoom: zoom ?? currZoom });
    }
  }

  handlePointer(funs: { pointermove?: (id: number) => void; click?: (id: number) => void }) {
    if (!this.map) throw new Error('Map not initialized.');
    for (const [k, v] of Object.entries(funs)) {
      this.map.on(k as 'pointermove' | 'click', (e) => {
        // Cannot use layer.getFeatures for WebGL.
        this.map!.forEachFeatureAtPixel(
          e.pixel,
          (f) => {
            const idx = f.getId() as number | undefined;
            // 0 is falsy.
            if (idx === undefined) {
              console.error("Feature doesn't have an id.");
              return true;
            }
            v(idx);
            return true; // Terminates search.
          },
          { layerFilter: (layer) => layer === this.layerMap.spots.layer, hitTolerance: 10 }
        );
      });
    }
  }
}
