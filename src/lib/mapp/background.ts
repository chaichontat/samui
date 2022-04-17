import TileLayer, { type SourceType } from 'ol/layer/WebGLTile.js';

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

/**
 * WebGL needs to run onMount.
 */
export function genTileLayer(): TileLayer {
  return new TileLayer({
    style: {
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
    }
  });
}
