import * as d3 from 'd3';
import Feature from 'ol/Feature.js';
import { Circle, Geometry, Point, Polygon } from 'ol/geom.js';

import type { Coord, CoordsData } from '$lib/data/objects/coords';
import {
  convertCategoricalToNumber,
  type FeatureAndGroup,
  type RetrievedData
} from '$src/lib/data/objects/feature';
import type { Sample } from '$src/lib/data/objects/sample';
import { keyLRU, keyOneLRU } from '$src/lib/lru';
import { rand } from '$src/lib/utils';
import { isEqual } from 'lodash-es';
import VectorLayer from 'ol/layer/Vector.js';
import WebGLPointsLayer from 'ol/layer/WebGLPoints.js';
import VectorSource from 'ol/source/Vector.js';
import { Fill, RegularShape, Stroke, Style } from 'ol/style.js';
import type { LiteralStyle } from 'ol/style/literal';
import { MapComponent } from '../definitions';
import type { Mapp } from '../mapp';
import { genSpotStyle } from './featureColormap';

export class WebGLSpots extends MapComponent<WebGLPointsLayer<VectorSource<Point>>> {
  outline?: CanvasSpots;
  _currStyle: string;
  uid: string;
  features?: Feature<Point>[];

  currSample?: string;
  currFeature?: FeatureAndGroup;

  constructor(map: Mapp) {
    super(map, genSpotStyle('categorical', 2));
    this.uid = rand();
    this._currStyle = 'categorical';
  }

  get currStyle() {
    return this._currStyle;
  }

  set currStyle(style: string) {
    if (!this.coords) throw new Error('Must run update first.');

    if (style === this._currStyle) return;
    switch (style) {
      case 'quantitative':
        this.updateStyle(genSpotStyle('quantitative', this.coords.sizePx));
        break;
      case 'categorical':
        this.updateStyle(genSpotStyle('categorical', this.coords.sizePx));
        break;
      default:
        throw new Error(`Unknown style: ${style}`);
    }
    this._currStyle = style;
    this._rebuildLayer().catch(console.error);
  }

  updateStyle(style: LiteralStyle) {
    this.webglStyle = style;
  }

  _updateProperties(sample: Sample, fn: FeatureAndGroup, { dataType, data }: RetrievedData) {
    if (!data) throw new Error('No intensity provided');
    if (!this.features) throw new Error('No features to update');

    // TODO: Subsample if coords subsampled.
    if (data?.length !== this.features.length) {
      console.error(
        `Intensity length doesn't match. Expected: ${this.source?.getFeatures().length}, got: ${
          data?.length
        }`
      );
      return false;
    }
    if (dataType === 'categorical') {
      ({ converted: data } = convertCategoricalToNumber({
        key: `${sample.name}-${fn.group}-${fn.feature}`,
        args: [data]
      }));
    }

    this.currStyle = dataType;
    for (const [i, f] of this.features.entries()) {
      f.setProperties({ value: data[i] });
    }
  }

  _updateOutline() {
    const shortEnough = this.coords!.pos!.length < 10000;
    if (shortEnough) {
      if (!this.outline) {
        this.outline = new CanvasSpots(this.map);
        this.outline.mount();
      }
      this.outline.update(this.coords!);
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
      style: this.webglStyle,
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

  async update(sample: Sample, fn: FeatureAndGroup) {
    if (!fn.feature) return false;
    const res = await sample.getFeature(fn);
    if (!res) return false;

    const { data, dataType, coords } = res;
    // Check if coord is the same.
    if (this.coords?.name !== coords.name) {
      this.source.clear();
      this.features = WebGLSpots.genPoints({
        key: `${sample.name}-${coords.name}`,
        args: [coords]
      });
      this.coords = coords;
    }

    if (this.currSample !== sample.name || !isEqual(this.currFeature, fn)) {
      this._updateProperties(sample, fn, { dataType, data });
      this.currFeature = fn;
      this.currSample = sample.name;
    }

    // Tell WebGL to update. Intentionally not updating on source directly to minimize redraws.
    this.source.getFeatures().length === 0
      ? this.source.addFeatures(this.features!)
      : this.source.changed();

    this._updateOutline();
    return;
  }

  async updateSample(sample: Sample) {
    if (!this.currFeature) return false;
    return await this.update(sample, this.currFeature);
  }

  static genPoints = keyLRU((coords: CoordsData) => {
    return coords.pos!.map(({ x, y, id, idx }) => {
      const f = new Feature({
        geometry: new Point([x * coords.mPerPx, -y * coords.mPerPx]),
        value: 0,
        id: id ?? idx
      });
      f.setId(idx);
      return f;
    });
  });
}

// TODO: Combine activespots and canvasspots
export class ActiveSpots extends MapComponent<VectorLayer<VectorSource<Geometry>>> {
  readonly feature: Feature<Circle>;

  constructor(map: Mapp) {
    super(
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
      style: this.webglStyle
    });
  }

  mount() {
    this.map.map!.addLayer(this.layer!);
    this._deferred.resolve();
    return this;
  }

  update(coords: CoordsData, idx: number) {
    this.visible = true;
    if (!coords.mPerPx) throw new Error('No mPerPx provided');
    const pos = coords.pos!.find((p) => p.idx === idx);
    if (!pos) {
      console.error(`No position found for idx ${idx}`);
      return;
    }

    const { x, y, id } = pos;
    const size = coords.size ? coords.size / 4 : coords.mPerPx * 10;
    this.feature.getGeometry()?.setCenterAndRadius([x * coords.mPerPx, -y * coords.mPerPx], size);
    this.feature.set('id', id);
    this.feature.setId(idx);
  }
}

export class CanvasSpots extends MapComponent<VectorLayer<VectorSource<Geometry>>> {
  constructor(map: Mapp, style?: Style) {
    super(
      map,
      style ??
        new Style({
          stroke: new Stroke({ color: '#ffffff66', width: 1 }),
          fill: new Fill({ color: 'transparent' })
        })
    );

    this.layer = new VectorLayer({
      source: this.source,
      style: this.webglStyle
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
    idx,
    mPerPx,
    size
  }: Coord & { idx: number; mPerPx: number; size?: number | null }) {
    const c = [x * mPerPx, -y * mPerPx];
    const f = new Feature({
      geometry: size !== undefined && size !== null ? new Circle(c, size / 4) : new Point(c),
      value: 0,
      id: id ?? idx
    });
    f.setId(idx);
    return f;
  }

  /// Replace entire feature.
  update(coords: CoordsData) {
    if (coords.mPerPx === undefined) throw new Error('mPerPx undefined.');
    if (coords.name === this.coords?.name || !coords.size) return;
    this.source.clear();
    this.source.addFeatures(
      coords.pos!.map((c) =>
        CanvasSpots._genCircle({ ...c, mPerPx: coords.mPerPx, size: coords.size })
      )
    );
    this.coords = coords;
  }

  get(idx: number) {
    return this.source.getFeatureById(idx);
  }
}

export class MutableSpots extends CanvasSpots {
  names: string[] = [];

  add(idx: number, name: string, ov: CoordsData, ant: string[]) {
    if (ov.mPerPx === undefined) throw new Error('mPerPx undefined.');
    let f = this.get(idx);
    if (f === null) {
      // Null to generate Point, instead of Circle.
      f = CanvasSpots._genCircle({ ...ov.pos![idx], idx, mPerPx: ov.mPerPx, size: null });
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

  addMultiple(idxs: number[], name: string, ov: CoordsData, ant: string[]) {
    idxs.forEach((idx) => this.add(idx, name, ov, ant));
  }

  addFromPolygon(polygonFeat: Feature<Polygon>, name: string, ov: CoordsData, ant: string[]) {
    if (!name) {
      alert('Set annotation name first.');
      return;
    }
    const polygon = polygonFeat.getGeometry()!;
    const template = [];
    for (let i = 0; i < ov.pos!.length; i++) {
      template.push(CanvasSpots._genCircle({ ...ov.pos![i], mPerPx: ov.mPerPx!, size: null }));
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
