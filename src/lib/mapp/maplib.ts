import Feature from 'ol/Feature.js';
import { Circle, Point } from 'ol/geom.js';
import { Vector as VectorLayer } from 'ol/layer.js';
import 'ol/ol.css';
import VectorSource from 'ol/source/Vector.js';
import type { Style } from 'ol/style.js';
import { params } from '../store';

export function colorVarFactory(mapping: { [key: string]: number }) {
  const len = Object.keys(mapping).length - 1;
  return (showing: [string, string, string], max: [number, number, number]) => {
    const variables = {
      blue: Math.min(mapping[showing[0]], len),
      green: Math.min(mapping[showing[1]], len),
      red: Math.min(mapping[showing[2]], len),
      blueMax: 255 - max[0],
      greenMax: 255 - max[1],
      redMax: 255 - max[2],
      blueMask: mapping[showing[0]] > len ? 0 : 1,
      greenMask: mapping[showing[1]] > len ? 0 : 1,
      redMask: mapping[showing[2]] > len ? 0 : 1
    };
    return variables;
  };
}

// WebGL;
export function getWebGLCircles() {
  const spotsSource = new VectorSource({ features: [] });

  const addData = (coords: { x: number; y: number }[]) =>
    spotsSource.addFeatures(
      coords.map(({ x, y }, i) => {
        const f = new Feature({
          geometry: new Point([x * params.mPerPx, -y * params.mPerPx]),
          value: 0
        });
        f.setId(i);
        return f;
      })
    );

  return { spotsSource, addData };
}

export function getCanvasCircle(style: Style) {
  const circleFeature = new Feature({ geometry: new Circle([0, 0], params.spotDiam / 2) });
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
