import type { CoordsData } from '$src/lib/data/objects/coords';
import { Deferrable } from '$src/lib/definitions';
import type { Mapp } from '$src/lib/ui/mapp';

import type { Geometry, Point } from 'ol/geom';
import type { Layer } from 'ol/layer';
import WebGLVectorLayer from 'ol/layer/WebGLVector';
import VectorSource from 'ol/source/Vector';
import type { Style } from 'ol/style';
import type { StyleVariables } from 'ol/style/flat';
import type { LiteralStyle } from 'ol/style/literal';

type MyWebGLVectorLayer = WebGLVectorLayer<VectorSource<Point>>;
export type OLLayer = Layer | MyWebGLVectorLayer;

export class MapComponent<T extends OLLayer> extends Deferrable {
  source: VectorSource<Geometry>;
  map: Mapp;
  layer?: T;
  style: LiteralStyle | Style;
  styleVariables?: StyleVariables;
  coords?: CoordsData;

  constructor(map: Mapp, style: LiteralStyle | Style, styleVariables?: StyleVariables) {
    super();
    this.map = map;
    this.style = style;
    this.styleVariables = styleVariables;
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
