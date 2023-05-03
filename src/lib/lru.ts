import { isEqual } from 'lodash-es';
import { LRUCache } from 'lru-cache';
import { get } from 'svelte/store';
import type { Sample } from './data/objects/sample';
import type { samples } from './store';

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
  const cache = new LRUCache<string, V>({ max });
  return (...args: K): V => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key) as V; // Checked
    const r = f(...args);
    cache.set(key, r);
    return r;
  };
}

export function keyLRU<T extends unknown[], R>(f: (...args: T) => R, max = 100) {
  const cache = new LRUCache<string, R>({ max });

  return ({ key, args }: { key: string; args: T }): R => {
    if (cache.has(key)) return cache.get(key) as R; // Checked
    const r = f(...args);
    cache.set(key, r);
    return r;
  };
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
    if (lastArgs && isEqual(lastArgs, args)) return lastResult;
    const newResult = f(...args);
    // if (newResult !== false) {
    lastArgs = args;
    lastResult = newResult;
    // }
    return lastResult;
  };
}

export function keyOneLRU<T extends unknown[], R>(f: (...args: T) => R) {
  let lastName: string;
  let lastResult: R;

  return ({ key, args }: { key: string; args: T }): R => {
    if (key === lastName) return lastResult;
    const res = f(...args);
    // if (res !== false) {
    lastName = key;
    lastResult = res;
    // }
    return res;
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
  store: typeof samples,
  update: (sample: Sample) => void | Promise<void>
): (s: string) => Promise<void> {
  return oneLRU(async (s: string) => {
    const sample = get(store).find((x) => x.name === s)!.sample;
    if (!sample) throw new Error(`Sample ${s} not found.`);
    if (!sample.hydrated) {
      await sample.hydrate();
    }
    const res = update(sample);
    return res instanceof Promise ? await res : res;
  });
}
