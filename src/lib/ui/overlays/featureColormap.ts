import type { FeatureType } from '$src/lib/data/objects/feature';
import { genLRU } from '$src/lib/lru';
import * as d3 from 'd3';
import { zip } from 'lodash-es';
import type { LiteralStyle } from 'ol/style/literal';

// export function genColor(band: string, color: keyof typeof _colors) {

//   return ['interpolate', ['linear'], normalize(band), ...genColormap(color)];
// }
const _colors = {
  viridis: d3.interpolateViridis,
  inferno: d3.interpolateInferno,
  magma: d3.interpolateMagma,
  plasma: d3.interpolatePlasma,
  warm: d3.interpolateWarm,
  cool: d3.interpolateCool,
  cubehelixDefault: d3.interpolateCubehelixDefault,
  rainbow: d3.interpolateRainbow,
  sinebow: d3.interpolateSinebow,
  blues: (t: number) => d3.interpolateBlues(1 - t),
  greens: d3.interpolateGreens,
  greys: d3.interpolateGreys,
  oranges: d3.interpolateOranges,
  purples: d3.interpolatePurples,
  reds: d3.interpolateReds,
  turbo: d3.interpolateTurbo,
  cividis: d3.interpolateCividis
};

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

/**
 * Generate a style for a feature layer.
 * @param type Feature type
 * @param spotDiamPx Diameter of a spot in pixels
 * @param imgmPerPx Resolution of the image in meters per pixel.
 *        Necessary to know the base resolution as openlayers operate in "zoom levels"
 *        Can be undefined if no image is loaded.
 * @param scale Whether to scale the features with zoom
 * @param min Minimum value of the feature for colormap
 * @param max Maximum value of the feature for colormap
 */
export function genSpotStyle(
  type: FeatureType,
  spotSizeMeter: number,
  mPerPx: number,
  scale = true,
  min = 0,
  max = 1
): LiteralStyle {
  // From mapp.ts
  // Lowest zoom level is 128x the native res of img.
  // Highest zoom level is 1/4x the native res of img.
  // The factor of 64 is 128 and the conversion of diameter to radius.
  const sizePx = spotSizeMeter / (mPerPx * 64);
  const ress = [...Array(10).keys()].map((i) => [i, sizePx * 2 ** (i - 1)]).flat();
  const common = scale
    ? {
        symbolType: 'circle',
        size: ['clamp', ['interpolate', ['exponential', 1.2], ['zoom'], ...ress], 2, 65535]
      }
    : {
        symbolType: 'circle',
        size: 2
      };

  if (type === 'quantitative') {
    // Interpolation step and color level.
    const colors = [...Array(10).keys()].flatMap((i) => [
      min + (max - min) * (i / 10),
      d3.interpolateTurbo(0.05 + (i / 10) * 0.95)
    ]);
    // colors[1] += 'ff';
    return {
      variables: { opacity: 0.9 },
      symbol: {
        ...common,
        color: ['interpolate', ['linear'], ['get', 'value'], ...colors],
        opacity: ['clamp', ['*', ['var', 'opacity'], ['get', 'opacity']], 0.15, 1] // Floor before can't hover above.
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
