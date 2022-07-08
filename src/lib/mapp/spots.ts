import Feature from 'ol/Feature.js';
import { Circle, Point } from 'ol/geom.js';
import VectorLayer from 'ol/layer/Vector.js';
import WebGLPointsLayer from 'ol/layer/WebGLPoints.js';
import VectorSource from 'ol/source/Vector.js';
import { Stroke, Style } from 'ol/style.js';
import type { LiteralStyle } from 'ol/style/literal';
import { tableau10arr } from '../colors';
import { convertCategoricalToNumber } from '../data/features';
import type { Overlay } from '../data/overlay';
import { Deferrable, interpolateTurbo } from '../utils';
import type { MapComponent, Mapp } from './mapp';

export class WebGLSpots extends Deferrable implements MapComponent {
  readonly source: VectorSource<Point>;
  layer?: WebGLPointsLayer<typeof this.source>;
  map: Mapp;
  _style: LiteralStyle;
  _mPerPx?: number;

  constructor(map: Mapp, { style }: { style?: LiteralStyle } = {}) {
    super();
    this.map = map;
    this.source = new VectorSource({ features: [] });
    this._style = style ?? {
      variables: { opacity: 1 },
      symbol: {
        size: ['interpolate', ['exponential', 2], ['zoom'], 1, 3, 4, 10],
        symbolType: 'circle',
        color: ['case', ...genCategoricalColors(), '#ffffff'],
        opacity: ['var', 'opacity']
      }
    };
  }

  mount(): void {
    this.layer = new WebGLPointsLayer({
      source: this.source,
      style: this._style,
      zIndex: 10
    });
    this._deferred.resolve();
  }

  async updateIntensity(map: Mapp, intensity: number[] | string[] | Promise<number[] | string[]>) {
    await map.promise;
    if (!intensity) throw new Error('No intensity provided');
    if (intensity instanceof Promise) {
      intensity = await intensity;
    }

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
    this._style = style;
    this._rebuildLayer();
  }

  _rebuildLayer() {
    const newLayer = new WebGLPointsLayer({
      source: this.source,
      style: this._style,
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

  update(overlay?: Overlay) {
    if (!overlay) return;
    this._mPerPx = overlay.mPerPx;
    this.source.clear();
    this.source.addFeatures(
      overlay.pos!.map(({ x, y }, i) => {
        const f = new Feature({
          geometry: new Point([x * this._mPerPx!, -y * this._mPerPx!]),
          value: 0,
          id: i
        });
        f.setId(i);
        return f;
      })
    );
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
        // color: '#fce652ff',
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

export class ActiveSpots extends Deferrable implements MapComponent {
  readonly source: VectorSource<Circle>;
  readonly layer: VectorLayer<typeof this.source>;
  readonly feature: Feature<Circle>;

  constructor(style: Style = new Style({ stroke: new Stroke({ color: '#ffffff', width: 1 }) })) {
    super();
    this.feature = new Feature({
      geometry: new Circle([0, 0]),
      value: 0
    });
    this.source = new VectorSource({
      features: [this.feature]
    });
    this.layer = new VectorLayer({
      source: this.source,
      zIndex: 50,
      style
    });
  }

  mount(): void {
    this._deferred.resolve();
  }

  update(ov: Overlay, idx: number) {
    if (!ov.mPerPx) throw new Error('No mPerPx or spotDiam provided');
    const { x, y } = ov.pos![idx];
    const size = ov.size ? ov.size / 4 : ov.mPerPx * 20;
    this.feature.getGeometry()?.setCenterAndRadius([x * ov.mPerPx, -y * ov.mPerPx], size);
  }
}
