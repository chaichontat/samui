export type Named<T> = { name: string; values: T };

export function classes(...classes: (false | null | undefined | string)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function rand() {
  return Math.random().toString(36).substring(2);
}

export function handleError(e: Error, stack = false) {
  console.error(e);
  alert(`${e?.message ?? e?.reason ?? e} ${stack ? e?.stack : ''}`);
}
