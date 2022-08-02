import * as d3 from 'd3';
import Feature from 'ol/Feature.js';
import { Circle, Geometry, Point, Polygon } from 'ol/geom.js';

import VectorLayer from 'ol/layer/Vector.js';
import WebGLPointsLayer from 'ol/layer/WebGLPoints.js';
import VectorSource from 'ol/source/Vector.js';
import { Fill, RegularShape, Stroke, Style } from 'ol/style.js';
import type { LiteralStyle } from 'ol/style/literal';
import { convertCategoricalToNumber, type Coord, type FeatureValues } from '../data/features';
import type { OverlayData } from '../data/overlay';
import { MapComponent } from './definitions';
import type { Mapp } from './mapp';

export function genSpotStyle(
  type: 'quantitative' | 'categorical',
  spotDiamPx: number
): LiteralStyle {
  const common = {
    symbolType: 'circle',
    size: [
      'interpolate',
      ['exponential', 1.2],
      ['zoom'],
      1,
      spotDiamPx / 64,
      2,
      spotDiamPx / 32,
      3,
      spotDiamPx / 16,
      4,
      spotDiamPx / 8,
      5,
      spotDiamPx / 2,
      6,
      spotDiamPx,
      7,
      spotDiamPx * 2
    ]
  };

  if (type === 'quantitative') {
    const colors = [...Array(10).keys()].flatMap((i) => [i, d3.interpolateTurbo(i / 10)]);
    colors[1] += 'ff';
    return {
      variables: { opacity: 1 },
      symbol: {
        ...common,
        color: ['interpolate', ['linear'], ['get', 'value'], ...colors],
        opacity: ['var', 'opacity']
        // opacity: ['clamp', ['var', 'opacity'], 0.05, 1]
      }
    };
  } else {
    return {
      variables: { opacity: 0.9 },
      symbol: {
        ...common,
        color: ['case', ...genCategoricalColors(), '#ffffff'],
        opacity: ['clamp', ['var', 'opacity'], 0.1, 1]
      }
    };
  }
}

function genCategoricalColors() {
  const colors = [];
  for (let i = 0; i < d3.schemeTableau10.length; i++) {
    colors.push(
      ['==', ['%', ['get', 'value'], d3.schemeTableau10.length], i],
      d3.schemeTableau10[i]
    );
  }
  return colors;
}

export class WebGLSpots extends MapComponent<WebGLPointsLayer<VectorSource<Point>>> {
  outline?: CanvasSpots;
  overlay?: OverlayData;
  _currStyle: string;

  constructor(name: string, map: Mapp) {
    super(name, map, genSpotStyle('categorical', 4));
    this._currStyle = 'categorical';
  }

  get currStyle() {
    return this._currStyle;
  }

  set currStyle(style: string) {
    if (!this.overlay) throw new Error('Must run update first.');

    if (style === this._currStyle) return;
    switch (style) {
      case 'quantitative':
        this.updateStyle(genSpotStyle('quantitative', this.overlay.sizePx));
        break;
      case 'categorical':
        this.updateStyle(genSpotStyle('categorical', this.overlay.sizePx));
        break;
      default:
        throw new Error(`Unknown style: ${style}`);
    }
    this._currStyle = style;
  }

  updateProperties({ dataType, data }: FeatureValues) {
    if (!data) throw new Error('No intensity provided');
    if (data?.length !== this.source?.getFeatures().length) {
      console.error(
        `Intensity length doesn't match. Expected: ${this.source?.getFeatures().length}, got: ${
          data?.length
        }`
      );
      return false;
    }

    ({ converted: data } = convertCategoricalToNumber(data));
    this.currStyle = dataType;

    for (let i = 0; i < data.length; i++) {
      this.source.getFeatureById(i)?.setProperties({ value: data[i] });
    }
  }

  updateStyle(style: LiteralStyle) {
    this.style = style;
    this._rebuildLayer().catch(console.error);
  }

  _updateOutline() {
    const shortEnough = this.overlay!.pos!.length < 10000;
    if (shortEnough) {
      if (!this.outline) {
        this.outline = new CanvasSpots(this.name + 'Outline', this.map);
        this.outline.mount();
      }
      this.outline.update(this.overlay!);
    } else {
      if (this.outline) {
        this.outline.dispose();
        this.outline = undefined;
      }
    }
  }

  async _rebuildLayer() {
    await this.map.promise;
    const newLayer = new WebGLPointsLayer({
      source: this.source as VectorSource<Point>,
      style: this.style,
      zIndex: 10
    });

    const prev = this.layer;
    this.map.map!.addLayer(newLayer);
    if (prev) {
      this.map.map!.removeLayer(prev);
      prev.dispose();
    }
    this.layer = newLayer;
  }

  update(overlay: OverlayData) {
    this.overlay = overlay;
    this.source.clear();
    this.source.addFeatures(
      overlay.pos!.map(({ x, y, id }, i) => {
        const f = new Feature({
          geometry: new Point([x * this.overlay!.mPerPx!, -y * this.overlay!.mPerPx!]),
          value: 0,
          id: id ?? i
        });
        f.setId(i);
        return f;
      })
    );
    this.overlay = overlay;
    this._rebuildLayer().catch(console.error);
    this._updateOutline();
  }
}

// TODO: Combine activespots and canvasspots
export class ActiveSpots extends MapComponent<VectorLayer<VectorSource<Geometry>>> {
  readonly feature: Feature<Circle>;

  constructor(name: string, map: Mapp) {
    super(
      name,
      map,
      new Style({
        stroke: new Stroke({ color: '#ffffff', width: 1 }),
        fill: new Fill({ color: 'transparent' })
      })
    );
    this.feature = new Feature({
      geometry: new Circle([0, 0]),
      value: 0
    });
    this.layer = new VectorLayer({
      source: new VectorSource({ features: [this.feature] }),
      zIndex: Infinity,
      style: this.style
    });
  }

  mount() {
    this.map.map!.addLayer(this.layer!);
    this._deferred.resolve();
    return this;
  }

  update(ov: OverlayData, idx: number) {
    if (!ov.mPerPx) throw new Error('No mPerPx provided');
    const { x, y } = ov.pos![idx];
    const size = ov.size ? ov.size / 4 : ov.mPerPx * 10;
    this.feature.getGeometry()?.setCenterAndRadius([x * ov.mPerPx, -y * ov.mPerPx], size);
  }
}

export class CanvasSpots extends MapComponent<VectorLayer<VectorSource<Geometry>>> {
  constructor(name: string, map: Mapp, style?: Style) {
    super(
      name,
      map,
      style ??
        new Style({
          stroke: new Stroke({ color: '#ffffff66', width: 1 }),
          fill: new Fill({ color: 'transparent' })
        })
    );

    this.layer = new VectorLayer({
      source: this.source,
      style: this.style
    });
  }

  mount() {
    this.map.map!.addLayer(this.layer!);
    this._deferred.resolve();
    return this;
  }

  static _genCircle({
    x,
    y,
    id,
    i,
    mPerPx,
    size
  }: Coord & { i: number; mPerPx: number; size?: number | null }) {
    const c = [x * mPerPx, -y * mPerPx];
    const f = new Feature({
      geometry: size !== undefined && size !== null ? new Circle(c, size / 4) : new Point(c),
      value: 0,
      id: id ?? i
    });
    f.setId(i);
    return f;
  }

  /// Replace entire feature.
  update(ov: OverlayData) {
    if (ov.mPerPx === undefined) throw new Error('mPerPx undefined.');
    this.source.clear();
    this.source.addFeatures(
      ov.pos!.map((coord, i) =>
        CanvasSpots._genCircle({ ...coord, i, mPerPx: ov.mPerPx!, size: ov.size })
      )
    );
    this.overlay = ov;
  }

  get(idx: number) {
    return this.source.getFeatureById(idx);
  }
}

export class MutableSpots extends CanvasSpots {
  names: string[] = [];

  add(idx: number, name: string, ov: OverlayData, ant: string[]) {
    if (ov.mPerPx === undefined) throw new Error('mPerPx undefined.');
    let f = this.get(idx);
    if (f === null) {
      // Null to generate Point, instead of Circle.
      f = CanvasSpots._genCircle({ ...ov.pos![idx], i: idx, mPerPx: ov.mPerPx, size: null });
      this.source.addFeature(f);
    }

    f.set('value', name);
    f.setStyle(
      new Style({
        image: new RegularShape({
          fill: new Fill({
            color: d3.schemeTableau10[ant.findIndex((x) => x === name) % 10] + 'ee'
          }),
          points: 5,
          radius: 10,
          radius2: 4,
          angle: 0
        })
      })
    );
  }

  addMultiple(idxs: number[], name: string, ov: OverlayData, ant: string[]) {
    idxs.forEach((idx) => this.add(idx, name, ov, ant));
  }

  addFromPolygon(polygonFeat: Feature<Polygon>, name: string, ov: OverlayData, ant: string[]) {
    if (!name) {
      alert('Set annotation name first.');
      return;
    }
    const polygon = polygonFeat.getGeometry()!;
    const template = [];
    for (let i = 0; i < ov.pos!.length; i++) {
      template.push(CanvasSpots._genCircle({ ...ov.pos![i], i, mPerPx: ov.mPerPx!, size: null }));
    }

    const filtered = ov
      .pos!.filter((f) => polygon.intersectsCoordinate([f.x * ov.mPerPx!, -f.y * ov.mPerPx!]))
      .map((p) => p.idx);

    this.addMultiple(filtered, name, ov, ant);
  }

  deleteFromPolygon(polygonFeat: Feature<Polygon>) {
    const polygon = polygonFeat.getGeometry()!;
    this.source.forEachFeatureIntersectingExtent(polygon.getExtent(), (f) => {
      this.source.removeFeature(f);
    });
  }

  delete(idx: number) {
    const f = this.source.getFeatureById(idx);
    if (f) {
      this.source.removeFeature(f);
    }
  }

  deleteByValue(name: string) {
    this.source.forEachFeature((f) => {
      if (f.get('value') === name) {
        this.source.removeFeature(f);
      }
    });
  }

  dump() {
    const points = this.source.getFeatures().map((f) => [f.get('id'), f.get('value')].join(','));
    return 'id,value\n' + points.join('\n');
  }
}
