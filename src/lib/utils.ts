import type { ClassValue } from 'clsx';

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type Named<T> = { name: string; values: T };

export function rand() {
  return Math.random().toString(36).substring(2);
}

export function handleError(e: Error, stack = false) {
  console.error(e);
  alert(`${e?.message ?? e?.reason ?? e} ${stack ? e?.stack : ''}`);
}

export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

export const classes = cn;
