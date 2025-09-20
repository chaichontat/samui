import { vi } from 'vitest';

vi.mock('$app/stores', async () => {
  const { readable, writable } = await import('svelte/store');
  /**
   * @type {import('$app/stores').getStores}
   */
  const getStores = () => ({
    navigating: readable(null),
    page: readable({ url: new URL('http://localhost'), params: {} }),
    session: writable(null),
    updated: readable(false)
  });
  /** @type {typeof import('$app/stores').page} */
  const page = {
    subscribe(fn) {
      return getStores().page.subscribe(fn);
    }
  };
  /** @type {typeof import('$app/stores').navigating} */
  const navigating = {
    subscribe(fn) {
      return getStores().navigating.subscribe(fn);
    }
  };
  /** @type {typeof import('$app/stores').session} */
  const session = {
    subscribe(fn) {
      return getStores().session.subscribe(fn);
    }
  };
  /** @type {typeof import('$app/stores').updated} */
  const updated = {
    subscribe(fn) {
      return getStores().updated.subscribe(fn);
    }
  };
  return {
    getStores,
    navigating,
    page,
    session,
    updated
  };
});

vi.mock('$app/environment', async () => {
  return {
    browser: true
  };
});

const consoleErrorMock = vi.fn();
console.error = consoleErrorMock;
window.alert = consoleErrorMock;
prompt = () => true;
console.log = vi.fn();
