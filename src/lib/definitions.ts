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
  _hydrated = false;

  constructor() {
    this._deferred = new Deferred();
    this.promise = this._deferred.promise;
  }

  get hydrated() {
    return this._hydrated;
  }

  set hydrated(h: boolean) {
    if (!h) throw new Error('Cannot set hydrated to false.');
    this._deferred.resolve();
    this._hydrated = h;
  }
}
