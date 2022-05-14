import { Deferrable } from '../utils';
import { convertLocalToNetwork, type Url } from './features';
type Coord = { x: number; y: number };
type Shape = 'circle';

export interface OverlayParams {
  name: string;
  shape: Shape;
  url?: Url;
  size?: number;
  mPerPx?: number;
  pos?: Coord[];
}

export class Overlay extends Deferrable {
  url?: Url;
  readonly name: string;
  shape: Shape;
  pos?: Coord[];
  size?: number;
  mPerPx?: number;
  hydrated = false;

  constructor({ name, shape, url, size, mPerPx, pos }: OverlayParams, autoHydrate = false) {
    super();
    this.name = name;
    this.shape = shape;
    this.url = url;
    this.pos = pos;
    this.size = size;
    this.mPerPx = mPerPx;

    if (!this.url && !this.pos) throw new Error('Must provide url or value');
    if (autoHydrate) {
      this.hydrate().catch(console.error);
    }
  }

  get sizePx() {
    if (!this.size || !this.mPerPx) throw new Error('Must provide size and mPerPx');
    return this.size / this.mPerPx;
  }

  async hydrate(handle?: FileSystemDirectoryHandle) {
    if (!this.pos && this.url) {
      if (handle) {
        this.url = await convertLocalToNetwork(handle, this.url);
      }
      this.pos = (await fetch(this.url.url).then((r) => r.json())) as Coord[];
    }
    this.hydrated = true;
    this._deferred.resolve();
    return this;
  }
}
