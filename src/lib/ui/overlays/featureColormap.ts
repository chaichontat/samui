import type { FeatureType } from '$src/lib/data/objects/feature';
import * as d3 from 'd3';
import type { LiteralStyle } from 'ol/style/literal';
import type { StyleVariables } from 'ol/style/flat';

export const colorMaps = {
  blues: (t: number) => `rgba(0,0,255,${t})`,
  greens: (t: number) => `rgba(0,255,0,${t})`,
  reds: (t: number) => `rgba(255,0,0,${t})`,
  turbo: d3.interpolateTurbo,
  viridis: d3.interpolateViridis,
  inferno: d3.interpolateInferno,
  magma: d3.interpolateMagma,
  plasma: d3.interpolatePlasma,
  warm: d3.interpolateWarm,
  cool: d3.interpolateCool,
  cubehelixDefault: d3.interpolateCubehelixDefault,
  rainbow: d3.interpolateRainbow,
  sinebow: d3.interpolateSinebow,
  greys: (t: number) => d3.interpolateGreys(1 - t),
  oranges: d3.interpolateOranges,
  purples: d3.interpolatePurples,
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

function genColorInterpolation(i: number) {
  const range = ['-', ['var', 'max'], ['var', 'min']];
  return ['+', ['var', 'min'], ['*', range, i]];
}

/**
 * Generate a style for a feature layer.
 * Only gets called when switching between quantitative and categorical.
 * Because a full WebGL rebuild is necessary to change styles.
 * @param type Feature type
 * @param spotDiamPx Diameter of a spot in pixels
 * @param imgmPerPx Resolution of the image in meters per pixel.
 *        Necessary to know the base resolution as openlayers operate in "zoom levels"
 *        Can be undefined if no image is loaded.
 * @param scale Whether to scale the features with zoom
 */
export type SpotStyle = { style: LiteralStyle; variables: StyleVariables };

export function genSpotStyle({
  type,
  spotSizeMeter,
  mPerPx,
  colorMap = 'turbo',
  scale = true
}: {
  type: FeatureType;
  spotSizeMeter: number;
  mPerPx: number;
  colorMap?: keyof typeof colorMaps;
  scale?: boolean;
}): SpotStyle {
  // From mapp.ts
  // Lowest zoom level is 128x the native res of img.
  // Highest zoom level is 1/4x the native res of img.
  // The factor of 64 is 128 and the conversion of diameter to radius.
  const diameterPx = spotSizeMeter / (mPerPx * 64);
  const baseRadiusPx = Math.max(diameterPx / 2, 1);
  const radiusStops = [...Array(10).keys()].map((i) => [i, baseRadiusPx * 2 ** (i - 1)]).flat();
  const radiusExpression = scale
    ? ['clamp', ['interpolate', ['exponential', 1.2], ['zoom'], ...radiusStops], 1, 32768]
    : baseRadiusPx;

  if (type === 'quantitative') {
    const colors = [...Array(10).keys()].flatMap((i) => [
      genColorInterpolation(i / 10),
      colorMaps[colorMap](0.05 + (i / 10) * 0.95)
    ]);

    return {
      style: {
        'circle-radius': radiusExpression,
        'circle-fill-color': ['interpolate', ['linear'], ['get', 'value'], ...colors],
        'circle-opacity': ['clamp', ['*', ['var', 'opacity'], ['get', 'opacity']], 0.15, 1]
      },
      variables: { opacity: 1, min: 0, max: 0 }
    } satisfies SpotStyle;
  }

  if (type === 'categorical') {
    return {
      style: {
        'circle-radius': radiusExpression,
        'circle-fill-color': ['case', ...genCategoricalColors(), '#ffffff'],
        'circle-opacity': ['clamp', ['var', 'opacity'], 0.15, 1]
      },
      variables: { opacity: 0.9 }
    } satisfies SpotStyle;
  }

  throw new Error('Unknown feature type');
}
