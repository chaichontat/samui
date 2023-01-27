export type Named<T> = { name: string; values: T };

export function classes(...classes: (false | null | undefined | string)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function rand() {
  return Math.random().toString(36).substring(2);
}

export function handleError(e: Error) {
  console.error(e);
  alert(`${e?.message ?? e?.reason ?? e} ${e?.stack}`);
}
