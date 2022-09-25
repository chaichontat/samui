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

const genColormap = genLRU((c: keyof typeof _colors) => {
  const range = [...Array(10).keys()];
  const cs = range
    .map((i) => 0.1 * i)
    .map((x) => {
      const z = d3.color(_colors[c](x))!.rgb();
      return [z.r, z.g, z.b, 1];
    });

  return zip(range, cs).flatMap((a) => a);
});

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

export function genSpotStyle(type: FeatureType, spotDiamPx: number, scale = true): LiteralStyle {
  const common = scale
    ? {
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
      }
    : {
        symbolType: 'circle',
        size: spotDiamPx
      };

  if (type === 'quantitative') {
    const colors = [...Array(10).keys()].flatMap((i) => [i, d3.interpolateTurbo(i / 10)]);
    colors[1] += 'ff';
    return {
      variables: { opacity: 0.8 },
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