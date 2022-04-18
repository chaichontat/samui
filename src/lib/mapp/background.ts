import type { ImageCtrl, ImageMode } from '$src/lib/mapp/imgControl';
import TileLayer, { type Style } from 'ol/layer/WebGLTile.js';

export function colorVarFactory(mode: ImageMode, mapping?: { [key: string]: number }) {
  if (mode === 'composite') {
    if (!mapping) throw new Error('Missing mapping for composite mode');
    const len = Object.keys(mapping).length - 1;

    return (imgCtrl: ImageCtrl) => {
      if (imgCtrl.type !== 'composite') throw new Error('Expected composite image control');
      const showing = imgCtrl.showing;
      const max = imgCtrl.maxIntensity;
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
  } else if (mode === 'rgb') {
    return (imgCtrl: ImageCtrl) => {
      if (imgCtrl.type !== 'rgb') throw new Error('Expected RGB image control');
      const ret: Omit<ImageCtrl, 'type'> = {
        Exposure: imgCtrl.Exposure,
        Contrast: imgCtrl.Contrast,
        Saturation: imgCtrl.Saturation
      };
      return ret;
    };
  } else {
    throw new Error(`Unknown mode`);
  }
}

export function genBgStyle(mode: ImageMode): Style {
  if (mode === 'composite') {
    return {
      variables: {
        blue: 1,
        green: 1,
        red: 1,
        blueMax: 128,
        greenMax: 128,
        redMax: 128,
        blueMask: 1,
        greenMask: 1,
        redMask: 1
      },
      color: [
        'array',
        ['*', ['/', ['band', ['var', 'red']], ['var', 'redMax']], ['var', 'redMask']],
        ['*', ['/', ['band', ['var', 'green']], ['var', 'greenMax']], ['var', 'greenMask']],
        ['*', ['/', ['band', ['var', 'blue']], ['var', 'blueMax']], ['var', 'blueMask']],
        1
      ]
    };
  } else {
    return {
      variables: {
        Exposure: 0,
        Contrast: 0,
        Saturation: 0
      },
      exposure: ['var', 'Exposure'],
      contrast: ['var', 'Contrast'],
      saturation: ['var', 'Saturation']
    };
  }
}
