import type { CoordsData } from '$src/lib/data/objects/coords';
import { Deferrable } from '$src/lib/definitions';
import type { Mapp } from '$src/lib/ui/mapp';

import type { Geometry, Point } from 'ol/geom';
import type { Layer } from 'ol/layer';
import type WebGLPointsLayer from 'ol/layer/WebGLPoints';
import VectorSource from 'ol/source/Vector';
import type { Style } from 'ol/style';
import type { LiteralStyle } from 'ol/style/literal';

type MyWebGLPointsLayer = WebGLPointsLayer<VectorSource<Point>>;
export type OLLayer = Layer | MyWebGLPointsLayer;

export class MapComponent<T extends OLLayer> extends Deferrable {
  source: VectorSource<Geometry>;
  map: Mapp;
  layer?: T;
  webglStyle: T extends MyWebGLPointsLayer ? LiteralStyle : Style;
  coords?: CoordsData;

  // outline?: CanvasSpots;

  constructor(
    map: Mapp,
    style: T extends WebGLPointsLayer<VectorSource<Point>> ? LiteralStyle : Style
  ) {
    super();
    this.map = map;
    this.webglStyle = style;
    this.source = new VectorSource();
  }

  set visible(visible: boolean) {
    if (!this.layer) throw new Error('No layer');
    this.layer.setVisible(visible);
  }

  get visible(): boolean {
    if (!this.layer) throw new Error('No layer');
    return this.layer.getVisible();
  }

  set z(z: number) {
    if (!this.layer) throw new Error('No layer');
    this.layer.setZIndex(z);
  }

  get z(): number {
    if (!this.layer) throw new Error('No layer');
    return this.layer.getZIndex();
  }

  mount() {
    this._deferred.resolve();
    return this;
  }

  dispose() {
    if (this.layer) {
      this.map.map?.removeLayer(this.layer);
      this.layer.dispose();
      // this.outline?.dispose();
    }
    this.source.dispose();
  }
}
