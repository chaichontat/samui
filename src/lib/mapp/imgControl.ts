export const colors = ['blue', 'green', 'red', 'magenta', 'cyan', 'yellow', 'white'] as const;
export const bgColors = [
  'bg-blue-600',
  'bg-green-600',
  'bg-red-600',
  'bg-fuchsia-500',
  'bg-cyan-500',
  'bg-yellow-500',
  'bg-white'
] as const;

export type BandInfo = { enabled: boolean; color: typeof colors[number]; max: number };

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
    };
  }
}

const maskMap: Record<BandInfo['color'], [number, number, number]> = {
  red: [1, 0, 0],
  green: [0, 1, 0],
  blue: [0, 0, 1],
  magenta: [1, 0, 1],
  cyan: [0, 1, 1],
  yellow: [1, 1, 0],
  white: [1, 1, 1]
};
