import type { ImgData } from '$src/lib/data/objects/image';
import {
  colors,
  type BandInfo,
  type CompCtrl,
  type ImgCtrl,
  type RGBCtrl
} from '$src/lib/ui/background/imgColormap';
import { isEqual, zip } from 'lodash-es';

type CompositeChannels = string[];

export function buildRgbController(): RGBCtrl {
  return { type: 'rgb', Exposure: 0, Contrast: 0, Saturation: 0 } as const;
}

export function buildCompositeController(image: ImgData): CompCtrl {
  if (!Array.isArray(image.channels)) {
    throw new Error('Composite controller requires channel array');
  }

  const restored = restoreCompositeController(image.channels);
  if (restored) return restored;

  const half = Math.round(image.maxVal / 2);
  const logHalf = Math.sqrt(half);

  const repeatedPalette = new Array(Math.ceil(image.channels.length / colors.length))
    .fill(colors)
    .flat();

  const variables: Record<string, BandInfo> = {};
  for (const [channel, color] of zip(image.channels, repeatedPalette)) {
    if (!channel || !color) continue;
    variables[channel] = { enabled: false, color, minmax: [0, logHalf] };
  }

  if (Object.keys(image.defaultChannels).length > 0) {
    for (const [color, channel] of Object.entries(image.defaultChannels)) {
      if (!channel) continue;
      variables[channel] = {
        enabled: true,
        color: color as BandInfo['color'],
        minmax: [0, logHalf]
      };
    }
  } else {
    const presets = ['red', 'green', 'blue'] as const;
    presets.forEach((color, idx) => {
      const defaultChannel = image.channels[idx];
      if (!defaultChannel) return;
      variables[defaultChannel] = { enabled: true, color, minmax: [0, logHalf] };
    });
  }

  return { type: 'composite', variables };
}

export function restoreCompositeController(channels: CompositeChannels): CompCtrl | null {
  const snapshot = localStorage.getItem('imgCtrl');
  if (!snapshot) return null;

  try {
    const parsed = JSON.parse(snapshot) as ImgCtrl;
    if (parsed?.type !== 'composite' || !parsed.variables) return null;
    if (!isEqual(Object.keys(parsed.variables), channels)) return null;

    const variables: Record<string, BandInfo> = {};
    for (const [channel, info] of Object.entries(parsed.variables)) {
      if (!info) continue;
      const { enabled, color, minmax } = info as BandInfo;
      variables[channel] = { enabled, color, minmax: [...minmax] as BandInfo['minmax'] };
    }

    return { type: 'composite', variables };
  } catch (error) {
    console.error('Failed to restore composite controller from localStorage', error);
    return null;
  }
}

export function selectChannelColor(
  controller: ImgCtrl | undefined,
  channel: string,
  color: BandInfo['color'] | undefined,
  allowToggleOff = false
): void {
  if (!controller || controller.type !== 'composite' || !color) return;

  const current = controller.variables[channel];
  if (!current) return;

  if (allowToggleOff && current.enabled && current.color === color) {
    current.enabled = false;
    return;
  }

  for (const [name, variable] of Object.entries(controller.variables)) {
    if (name === channel) continue;
    if (variable.color === color && variable.enabled) {
      variable.enabled = false;
    }
  }

  current.enabled = true;
  current.color = color;
}

export function cloneController(ctrl: ImgCtrl | undefined): ImgCtrl | undefined {
  if (!ctrl) return undefined;
  return JSON.parse(JSON.stringify(ctrl)) as ImgCtrl;
}

