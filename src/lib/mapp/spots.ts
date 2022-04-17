import Feature from 'ol/Feature.js';
import { Circle, Point } from 'ol/geom.js';
import { Vector as VectorLayer } from 'ol/layer.js';

import 'ol/ol.css';
import VectorSource from 'ol/source/Vector.js';
import type { Style } from 'ol/style.js';
import type { LiteralStyle } from 'ol/style/literal';

// WebGL;
export function getWebGLCircles(mPerPx: number) {
  const spotsSource = new VectorSource({ features: [] });

  const addData = (coords: { x: number; y: number }[]) =>
    spotsSource.addFeatures(
      coords.map(({ x, y }, i) => {
        const f = new Feature({
          geometry: new Point([x * mPerPx, -y * mPerPx]),
          value: 0
        });
        f.setId(i);
        return f;
      })
    );

  return { spotsSource, addData };
}

export function getCanvasCircle(style: Style, spotDiam: number) {
  const circleFeature = new Feature({ geometry: new Circle([0, 0], spotDiam / 2) });
  const circleSource = new VectorSource({ features: [circleFeature] });
  const activeLayer = new VectorLayer({
    source: circleSource,
    style
  });

  //   const addData = (coords: { x: number; y: number }[]) =>
  //     circlesSource.addFeatures(
  //       coords.map(({ x, y }, i) => {
  //         const f = new Feature({ geometry: new Circle([x, y], 130.75 / 2) });
  //         f.setId(i);

  //         return f;
  //       })
  //     );

  return { circleFeature, circleSource, activeLayer };
}

export function genStyle(spotPx: number): LiteralStyle {
  return {
    variables: { opacity: 0.5 },
    symbol: {
      symbolType: 'circle',
      size: [
        'interpolate',
        ['exponential', 2],
        ['zoom'],
        1,
        spotPx / 32,
        2,
        spotPx / 16,
        3,
        spotPx / 8,
        4,
        spotPx / 4,
        5,
        spotPx
      ],
      color: '#fce652ff',
      // color: ['interpolate', ['linear'], ['get', rna], 0, '#00000000', 8, '#fce652ff'],
      opacity: ['clamp', ['*', ['var', 'opacity'], ['/', ['get', 'value'], 8]], 0.1, 1]
      // opacity: ['clamp', ['var', 'opacity'], 0.05, 1]
    }
  };
}
