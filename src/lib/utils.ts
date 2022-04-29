import LRU from 'lru-cache';
import { get, type Writable } from 'svelte/store';
import tippy from 'tippy.js';
import type { Sample } from './data/sample';

/**
 * Decorates a function with LRU caching.
 * Do not use array as arguments. Really hard to assure equality.
 * Mutable objects are also a no-no.
 * @param f - (...args: Exclude<T, unknown[]>[]) => V
 * @param [max=100] - The maximum number of items to store in the cache.
 */
export function genLRU<T, K extends Exclude<T, unknown[]>[], V>(
  f: (...args: K) => V,
  max = 100
): (...args: K) => V {
  const cache = new LRU<string, V>({ max });
  return (...args: K): V => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key) as V; // Checked
    const r = f(...args);
    cache.set(key, r);
    return r;
  };
}

export function clickOutside(node: HTMLElement) {
  const handleClick = (event: MouseEvent) => {
    if (node && !node.contains(event.target) && !event.defaultPrevented) {
      node.dispatchEvent(new CustomEvent('outclick'));
    }
  };

  document.addEventListener('click', handleClick, true);

  return {
    destroy() {
      document.removeEventListener('click', handleClick, true);
    }
  };
}

export function tooltip(node: HTMLElement, content: string) {
  node.setAttribute('aria-label', content);
  node.title = '';
  const tip = tippy(node, { content, delay: [100, 0] });
  return {
    update: (newmsg: string): void => tip.setContent(newmsg),
    destroy: (): void => tip.destroy()
  };
}

function interpolateTurbo(x: number) {
  x = Math.max(0, Math.min(1, x));
  return (
    '#' +
    [
      34.61 + x * (1172.33 - x * (10793.56 - x * (33300.12 - x * (38394.49 - x * 14825.05)))),
      23.31 + x * (557.33 + x * (1225.33 - x * (3574.96 - x * (1073.77 + x * 707.56)))),
      27.2 + x * (3211.1 - x * (15327.97 - x * (27814 - x * (22569.18 - x * 6838.66))))
    ]
      .map(Math.floor)
      .map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0'))
      .join('')
  );
}

export function resizable(resizer: HTMLDivElement) {
  const leftSide = resizer.previousElementSibling!;
  const rightSide = resizer.nextElementSibling!;

  // The current position of mouse
  let x = 0;
  let y = 0;
  let leftWidth = 0;

  const mouseDownHandler = (e: MouseEvent) => {
    x = e.clientX;
    y = e.clientY;
    leftWidth = leftSide.getBoundingClientRect().width;

    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
  };

  const mouseMoveHandler = (e: MouseEvent) => {
    const dx = e.clientX - x;
    const dy = e.clientY - y;

    const newLeftWidth =
      ((leftWidth + dx) * 100) / resizer.parentNode!.getBoundingClientRect().width;
    leftSide.style.width = `${newLeftWidth}%`;

    resizer.style.cursor = 'col-resize';
    document.body.style.cursor = 'col-resize';

    leftSide.style.userSelect = 'none';
    leftSide.style.pointerEvents = 'none';

    rightSide.style.userSelect = 'none';
    rightSide.style.pointerEvents = 'none';
  };

  const mouseUpHandler = () => {
    resizer.style.removeProperty('cursor');
    document.body.style.removeProperty('cursor');

    leftSide.style.removeProperty('user-select');
    leftSide.style.removeProperty('pointer-events');

    rightSide.style.removeProperty('user-select');
    rightSide.style.removeProperty('pointer-events');

    document.body.dispatchEvent(new Event('resize'));

    document.removeEventListener('mousemove', mouseMoveHandler);
    document.removeEventListener('mouseup', mouseUpHandler);
  };

  resizer.addEventListener('mousedown', mouseDownHandler);
}

/**
 * Decorates a function with an LRU with a cache size of 1.
 * Mainly to prevent state change functions from being called when the state is the same.
 */
export function oneLRU<P, T extends Exclude<P, unknown[]>[], R>(
  f: (...args: T) => R
): (...args: T) => R {
  let lastArgs: T;
  let lastResult: R;
  return (...args: T): R => {
    if (args.some((a) => Array.isArray(a))) {
      throw new Error(`doNotRepeat: args must not be arrays.`);
    }
    if (lastArgs && lastArgs.every((a, i) => a === args[i])) return lastResult;
    lastArgs = args;
    lastResult = f(...args);
    return lastResult;
  };
}

export function keyOneLRU<T extends unknown[], R>(f: (...args: T) => R | false) {
  let lastName: string;
  let lastResult: R;

  return ({ key, args }: { key: string; args: T }): R | false => {
    if (key === lastName) return lastResult;
    const res = f(...args);
    if (res !== false) {
      lastName = key;
      lastResult = res;
    }
    return res;
  };
}

export function keyLRU<T extends unknown[], R>(f: (...args: T) => R, max = 100) {
  const cache = new LRU<string, R>({ max });

  return ({ key, args }: { key: string; args: T }): R => {
    if (cache.has(key)) return cache.get(key) as R; // Checked
    const r = f(...args);
    cache.set(key, r);
    return r;
  };
}

/**
 * Wraps the update function. Hydrates the sample if not already done then call update.
 * Also wrapped with oneLRU to prevent repeated calls on the same sample.
 * This assumes that the sample is not mutated.
 * Like the LRU above, do not use array as arguments.
 * @returns A function that takes a string and returns a promise that resolves to void.
 */
export function genUpdate(
  store: Writable<{ [key: string]: Sample }>,
  update: (sample: Sample) => void | Promise<void>
): (s: string) => Promise<void> {
  return oneLRU(async (s: string) => {
    const sample = get(store)[s];
    if (!sample) throw new Error(`Sample ${s} not found.`);
    if (!sample.hydrated) {
      await sample.hydrate();
    }
    const res = update(sample);
    return res instanceof Promise ? await res : res;
  });
}

export async function getFile(handle: FileSystemDirectoryHandle, name: string) {
  return await handle.getFileHandle(name).then((fh) => fh.getFile());
}

export class Deferred<T extends unknown[] = [void], R = void> {
  resolve!: (arg: R) => void;
  reject!: () => void;
  promise: Promise<R>;
  f: (...args: T) => R;

  // @ts-expect-error
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  constructor(f: (...args: T) => R = () => {}) {
    this.f = f;
    this.promise = new Promise(
      (resolve, reject) => ([this.resolve, this.reject] = [resolve, reject])
    );
  }

  run(...args: T) {
    this.resolve(this.f(...args));
  }
}

export class Deferrable {
  readonly promise: Promise<void>;
  readonly _deferred: Deferred<[void], void>;

  constructor() {
    this._deferred = new Deferred();
    this.promise = this._deferred.promise;
  }
}

export type Named<T> = { name: string; values: T };

export function classNames(...classes: (false | null | undefined | string)[]): string {
  return classes.filter(Boolean).join(' ');
}
