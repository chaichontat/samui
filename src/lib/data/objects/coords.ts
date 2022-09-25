import { Deferrable } from '$src/lib/definitions';
import { convertLocalToNetwork, fromCSV, type Url } from '$src/lib/io';

type Shape = 'circle';

export interface Coord {
  x: number;
  y: number;
  idx?: number;
  id?: string | number;
}

export interface CoordsParams {
  name: string;
  shape: Shape;
  mPerPx: number;
  url?: Url;
  size?: number;
  pos?: Coord[];
  addedOnline?: boolean;
  sample?: number;
}

export class CoordsData extends Deferrable {
  url?: Url;
  readonly name: string;
  shape: Shape;
  pos?: Coord[];
  _posOri?: Coord[];
  size?: number;
  mPerPx: number;
  addedOnline: boolean;
  sample: number;

  constructor(
    { name, shape, url, size, mPerPx, pos, addedOnline, sample }: CoordsParams,
    autoHydrate = false
  ) {
    super();
    this.name = name;
    this.shape = shape;
    this.url = url;
    this._posOri = this.pos = pos;
    this.size = size;
    this.mPerPx = mPerPx;
    this.addedOnline = addedOnline ?? false;
    this.sample = sample ?? 100000;

    if (!this.url && !this.pos) throw new Error('Must provide url or value');
    if (this.pos) {
      this.pos.forEach((p, i) => (p.idx = i));
      this.pos = this.subsample(this.sample);
    }

    if (autoHydrate) {
      this.hydrate().catch(console.error);
    }
  }

  get sizePx() {
    if (!this.mPerPx) throw new Error('Must provide mPerPx');
    // Defaults to 20 for objects without size.
    return this.size ? this.size / this.mPerPx : 10;
  }

  async hydrate(handle?: FileSystemDirectoryHandle) {
    if (!this.pos && this.url) {
      if (handle) {
        this.url = await convertLocalToNetwork(handle, this.url);
      }
      await fromCSV(this.url.url, { download: true }).then(
        (x) => (this._posOri = this.pos = x?.data as Coord[])
      );
    } else {
      console.info(`Overlay ${this.name} has no url or pos.`);
    }
    this.pos!.forEach((p, i) => (p.idx = i));
    this.pos = this.subsample(this.sample);
    this.hydrated = true;
    return this;
  }

  subsample(n: number) {
    if (this.pos!.length > n) {
      const step = Math.ceil(this.pos!.length / n);
      return this.pos!.filter((_, i) => i % step === 0);
    }
    return this.pos;
  }
}
