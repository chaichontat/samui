import * as d3 from 'd3';
import Feature from 'ol/Feature.js';
import { Circle, Geometry, Point } from 'ol/geom.js';

import VectorLayer from 'ol/layer/Vector.js';
import WebGLPointsLayer from 'ol/layer/WebGLPoints.js';
import VectorSource from 'ol/source/Vector.js';
import { Fill, RegularShape, Stroke, Style } from 'ol/style.js';
import type { LiteralStyle } from 'ol/style/literal';
import { tableau10arr } from '../colors';
import { convertCategoricalToNumber, type Coord } from '../data/features';
import type { OverlayData } from '../data/overlay';
import { interpolateTurbo } from '../utils';
import { MapComponent } from './definitions';
import type { Mapp } from './mapp';

export class WebGLSpots extends MapComponent<WebGLPointsLayer<VectorSource<Point>>> {
  outline?: CanvasSpots;
  _mPerPx?: number;

  constructor(name: string, map: Mapp, style?: LiteralStyle) {
    super(
      name,
      map,
      style ?? {
        variables: { opacity: 1 },
        symbol: {
          size: ['interpolate', ['exponential', 2], ['zoom'], 1, 3, 4, 10],
          symbolType: 'circle',
          color: ['case', ...genCategoricalColors(), '#ffffff'],
          opacity: ['var', 'opacity']
        }
      }
    );
  }

  updateProperties(intensity: number[] | string[]) {
    if (!intensity) throw new Error('No intensity provided');

    if (intensity?.length !== this.source?.getFeatures().length) {
      console.error(
        `Intensity length doesn't match. Expected: ${this.source?.getFeatures().length}, got: ${
          intensity?.length
        }`
      );
      return false;
    }

    ({ converted: intensity } = convertCategoricalToNumber(intensity));

    for (let i = 0; i < intensity.length; i++) {
      this.source.getFeatureById(i)?.setProperties({ value: intensity[i] });
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
    this._mPerPx = overlay.mPerPx;
    this.source.clear();
    this.source.addFeatures(
      overlay.pos!.map(({ x, y, id }, i) => {
        const f = new Feature({
          geometry: new Point([x * this._mPerPx!, -y * this._mPerPx!]),
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
    const colors = [...Array(10).keys()].flatMap((i) => [i, interpolateTurbo(i / 10)]);
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
  for (let i = 0; i < tableau10arr.length; i++) {
    colors.push(['==', ['%', ['get', 'value'], tableau10arr.length], i], tableau10arr[i]);
  }
  return colors;
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

  remove(idx: number) {
    const f = this.get(idx);
    if (f) {
      this.source.removeFeature(f);
    } else {
      console.warn('Removing non-existent feature with idx:', idx);
    }
  }

  add(idx: number, name: string, ov: OverlayData, ant: string[]) {
    if (ov.mPerPx === undefined) throw new Error('mPerPx undefined.');
    let f = this.get(idx);
    if (f === null) {
      f = CanvasSpots._genCircle({ ...ov.pos![idx], i: idx, mPerPx: ov.mPerPx, size: ov.size });
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
    console.log(this.dump());
  }

  delete(idx: number) {
    const f = this.source.getFeatureById(idx);
    if (f) {
      this.source.removeFeature(f);
    }
  }

  dump() {
    const points = this.source.getFeatures().map((f) => [f.get('id'), f.get('value')].join(','));
    return 'id,value\n' + points.join('\n');
  }
}
