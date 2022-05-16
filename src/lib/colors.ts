import { interpolateTurbo } from './utils';

export const tableau10: { [name: string]: `#${string}` } = {
  blue: '#5778a4',
  orange: '#e49444',
  red: '#d1615d',
  teal: '#85b6b2',
  green: '#6a9f58',
  yellow: '#e7ca60',
  purple: '#a87c9f',
  pink: '#f1a2a9',
  brown: '#967662',
  grey: '#b8b0ac'
};

export const tableau10arr = Object.values(tableau10);

export const viridis = [
  '#440154, #482475, #414487, #355f8d, #2a788e, #21908d, #22a884, #42be71, #7ad151, #bddf26, #bddf26'
];

const turbo_ = [...Array(10).keys()].map((x) => interpolateTurbo(x / 10));
turbo_[0] += '00';
export const turbo = turbo_;
