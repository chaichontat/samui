import { fromCSV } from '../io';
import { Deferrable } from '../utils';
import { convertLocalToNetwork, type Coord, type Url } from './features';

type Shape = 'circle';

export interface CoordsParams {
  name: string;
  shape: Shape;
  mPerPx: number;
  url?: Url;
  size?: number;
  pos?: Coord[];
  addedOnline?: boolean;
}

export class CoordsData extends Deferrable {
  url?: Url;
  readonly name: string;
  shape: Shape;
  pos?: Coord[];
  size?: number;
  mPerPx: number;
  addedOnline: boolean;

  constructor(
    { name, shape, url, size, mPerPx, pos, addedOnline }: CoordsParams,
    autoHydrate = false
  ) {
    super();
    this.name = name;
    this.shape = shape;
    this.url = url;
    this.pos = pos;
    this.size = size;
    this.mPerPx = mPerPx;
    this.addedOnline = addedOnline ?? false;

    if (!this.url && !this.pos) throw new Error('Must provide url or value');

    if (autoHydrate) {
      this.hydrate().catch(console.error);
    }
  }

  get sizePx() {
    if (!this.mPerPx) throw new Error('Must provide mPerPx');
    // Defaults to 20 for objects without size.
    return this.size ? this.size / this.mPerPx : 20;
  }

  async hydrate(handle?: FileSystemDirectoryHandle) {
    if (!this.pos && this.url) {
      if (handle) {
        this.url = await convertLocalToNetwork(handle, this.url);
      }
      await fromCSV(this.url.url, { download: true }).then((x) => (this.pos = x?.data as Coord[]));
    } else {
      console.info(`Overlay ${this.name} has no url or pos.`);
    }
    this.pos!.forEach((p, i) => (p.idx = i));
    this.hydrated = true;
    return this;
  }
}
