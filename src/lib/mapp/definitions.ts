import type { Map, MapBrowserEvent, Overlay } from 'ol';

import type { Circle, Geometry, Point } from 'ol/geom';
import type { Layer } from 'ol/layer';
import type WebGLPointsLayer from 'ol/layer/WebGLPoints';
import type GeoTIFFSource from 'ol/source/GeoTIFF';
import VectorSource from 'ol/source/Vector';
import type { Style } from 'ol/style';
import type { LiteralStyle } from 'ol/style/literal';
import type { OverlayData } from '../data/overlay';

import { Deferrable } from '../utils';
import type { Mapp } from './mapp';
import type { CanvasSpots } from './spots';

// export interface MapComponent<T extends Layer | WebGLPointsLayer<VectorSource<Point>>>
//   extends Deferrable {
//   readonly name: string;
//   readonly map: Map;
//   z: number;
//   visible: boolean;

//   readonly source?: VectorSource<Geometry> | GeoTIFFSource;
//   readonly layer?: T;

//   dispose(): void;
//   update(...args: unknown[]): void;
//   mount(...args: unknown[]): void;
// }

type MyWebGLPointsLayer = WebGLPointsLayer<VectorSource<Point>>;
export type OLLayer = Layer | MyWebGLPointsLayer;

export class MapComponent<T extends OLLayer> extends Deferrable {
  readonly name: string;
  source: VectorSource<Geometry>;
  map: Mapp;
  layer?: T;
  style: T extends MyWebGLPointsLayer ? LiteralStyle : Style;
  overlay?: OverlayData;

  outline?: CanvasSpots;

  constructor(
    name: string,
    map: Mapp,
    style: T extends WebGLPointsLayer<VectorSource<Point>> ? LiteralStyle : Style
  ) {
    super();
    this.name = name;
    this.map = map;
    this.style = style;
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
    }
    this.source.dispose();
  }

  update(ol: OverlayData, ...args: unknown[]) {
    throw new Error('Method not implemented.');
  }

  updateProperties(...args: unknown[]) {
    throw new Error('Method not implemented.');
  }
}
