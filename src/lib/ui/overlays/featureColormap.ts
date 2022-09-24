import { genLRU } from '$src/lib/lru';
import * as d3 from 'd3';
import { zip } from 'lodash-es';

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
