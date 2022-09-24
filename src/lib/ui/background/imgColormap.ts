import type { Style } from 'ol/layer/WebGLTile.js';
import { WebGLColorFunc } from '../webglcolor';

export const colors = ['blue', 'green', 'red', 'magenta', 'cyan', 'yellow', 'white'] as const;
export const bgColors = [
  'bg-blue-700',
  'bg-green-600',
  'bg-red-700',
  'bg-fuchsia-500',
  'bg-cyan-500',
  'bg-yellow-500',
  'bg-gray-200'
] as const;

export type BandInfo = { enabled: boolean; color: typeof colors[number]; max: number };
export type CompCtrl = { type: 'composite'; variables: Record<string, BandInfo> };
export type RGBCtrl = { type: 'rgb'; Exposure: number; Contrast: number; Saturation: number };
export type ImgCtrl = CompCtrl | RGBCtrl;

export function genCompStyle(bands: string[]): Style {
  const vars: Record<string, number> = {};
  bands.forEach((b, i) => {
    vars[b] = i + 1;
    vars[`${b}Max`] = 128;
    vars[`${b}redMask`] = 1;
    vars[`${b}greenMask`] = 1;
    vars[`${b}blueMask`] = 1;
  });
  return { variables: vars, color: WebGLColorFunc.genColors(bands) };
}

const maskMap: Record<typeof colors[number], [0 | 1, 0 | 1, 0 | 1]> = {
  red: [1, 0, 0],
  green: [0, 1, 0],
  blue: [0, 0, 1],
  magenta: [1, 0, 1],
  cyan: [0, 1, 1],
  yellow: [1, 1, 0],
  white: [1, 1, 1]
};

export function decomposeColors(bands: string[], imgCtrl: CompCtrl) {
  const out: Record<string, number> = {};
  for (const [i, b] of bands.entries()) {
    const { enabled, color, max } = imgCtrl.variables[b];
    const masks = [`${b}redMask`, `${b}greenMask`, `${b}blueMask`];
    out[`${b}Max`] = 255 - max;
    out[b] = i + 1;
    if (!enabled) {
      masks.forEach((m) => (out[m] = 0));
    } else {
      maskMap[color].forEach((m, i) => (out[masks[i]] = m));
    }
  }
  return out;
}

export function genRGBStyle(): Style {
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
