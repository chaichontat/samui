import * as d3 from 'd3';
import { zip } from 'lodash-es';
import { genLRU } from '../utils';

export const magenta = [
  'array',
  ['*', ['/', ['band', ['var', 'red']], ['var', 'redMax']], ['var', 'redMask']],
  ['*', ['/', ['band', ['var', 'green']], ['var', 'greenMax']], ['var', 'greenMask']],
  ['*', ['/', ['band', ['var', 'blue']], ['var', 'blueMax']], ['var', 'blueMask']],
  1
];

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

export function genColor(band: string, color: keyof typeof _colors) {
  return ['interpolate', ['linear'], normalize(band), ...genColormap(color)];
}
function normalize(band: string) {
  return ['/', ['band', ['var', band]], ['var', `${band}Max`]];
}

function mask(band: ReturnType<typeof normalize>, mask: string) {
  return ['*', band, ['var', mask]];
}

function clamp(band: unknown[], min = 0, max = 1) {
  return ['clamp', band, min, max];
}

function add(...x: unknown[]) {
  if (x.length === 2) return ['+', x[0], x[1]];
  return ['+', add(...x.slice(0, x.length - 1)), x[x.length - 1]];
}

export function genF(bands: string[]) {
  const cs = ['red', 'green', 'blue'].map((rgb) =>
    clamp(add(...bands.map((b) => mask(normalize(b), `${b}${rgb}Mask`))))
  );
  return ['array', ...cs, 1];
}

export function genStyle(bands: string[]) {
  const vars: Record<string, number> = {};
  bands.forEach((b, i) => {
    vars[b] = i + 1;
    vars[`${b}Max`] = 128;
    vars[`${b}redMask`] = 1;
    vars[`${b}greenMask`] = 1;
    vars[`${b}blueMask`] = 1;
  });

  return {
    variables: vars,
    color: genF(bands)
  };
}
