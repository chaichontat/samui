import { maskMap, type BandInfo } from './imgColormap';

export const colors = ['blue', 'green', 'red', 'magenta', 'white'] as const;
export const bgColors = [
  'bg-blue-600',
  'bg-green-600',
  'bg-red-600',
  'bg-fuchsia-500',
  'bg-white'
] as const;

type CompCtrl = { type: 'composite'; variables: Record<string, BandInfo> };
type RGBCtrl = { type: 'rgb'; Exposure: number; Contrast: number; Saturation: number };
export type ImageCtrl = CompCtrl | RGBCtrl;

export function colorVarFactory(mapping: string[] | 'rgb' | null) {
  // if (!mapping) return;
  if (mapping === 'rgb') {
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
    if (!mapping) throw new Error('Missing mapping for composite mode');
    return (imgCtrl: ImageCtrl) => {
      if (imgCtrl.type !== 'composite') throw new Error('Expected composite image control');
      const bands = mapping;
      const out: Record<string, number> = {};

      for (const [i, b] of bands.entries()) {
        const { enabled, color, minmax } = imgCtrl.variables[b];
        const masks = [`${b}redMask`, `${b}greenMask`, `${b}blueMask`];
        [out[`${b}Min`], out[`${b}Max`]] = minmax;
        out[b] = i + 1;
        if (!enabled) {
          masks.forEach((m) => (out[m] = 0));
        } else {
          maskMap[color].forEach((m, i) => (out[masks[i]] = m));
        }
      }
      return out;
    };
  }
}
