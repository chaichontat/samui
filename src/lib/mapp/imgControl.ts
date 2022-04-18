export type ImageMode = 'composite' | 'rgb';

type CompCtrl = { type: 'composite'; showing: string[]; maxIntensity: number[] };
type RGBCtrl = { type: 'rgb'; Exposure: number; Contrast: number; Saturation: number };
export type ImageCtrl = CompCtrl | RGBCtrl;
