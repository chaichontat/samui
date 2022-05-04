type CompCtrl = { type: 'composite'; showing: string[]; maxIntensity: number[] };
type RGBCtrl = { type: 'rgb'; Exposure: number; Contrast: number; Saturation: number };
export type ImageCtrl = CompCtrl | RGBCtrl;
export type ImageMode = 'composite' | 'rgb';

export function colorVarFactory(
  mode: 'composite' | 'rgb',
  mapping?: Record<string, number> | null
) {
  if (mode === 'composite') {
    if (!mapping) throw new Error('Missing mapping for composite mode');
    return (imgCtrl: ImageCtrl) => {
      if (imgCtrl.type !== 'composite') throw new Error('Expected composite image control');

      const showing = imgCtrl.showing;
      const max = imgCtrl.maxIntensity;

      return ['blue', 'green', 'red']
        .map((c, i) => ({
          [c]: showing[i] === 'None' ? 1 : mapping[showing[i]],
          [c + 'Max']: 255 - max[i],
          [c + 'Mask']: showing[i] === 'None' ? 0 : 1
        }))
        .reduce((acc, x) => Object.assign(acc, x), {});
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

// const colorVar = colorVarFactory(mode, channels);
