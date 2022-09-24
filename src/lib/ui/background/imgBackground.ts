import { View, type Map } from 'ol';
import WebGLTileLayer from 'ol/layer/WebGLTile';
import GeoTIFF from 'ol/source/GeoTIFF';
import type { ImgData } from '../../data/objects/image';
import { Deferrable } from '../../definitions';
import { oneLRU } from '../../lru';
import {
  decomposeColors,
  genCompStyle,
  genRGBStyle,
  type CompCtrl,
  type RGBCtrl
} from './imgColormap';

export class Background extends Deferrable {
  source?: GeoTIFF;
  layer?: WebGLTileLayer;
  mPerPx?: number;
  image?: ImgData;

  constructor() {
    super();
  }

  mount() {
    if (!this.layer) {
      this.layer = new WebGLTileLayer({ zIndex: 0 });
    }
    this._deferred.resolve();
    return this;
  }

  dispose(map: Map | undefined) {
    if (this.layer) {
      map?.removeLayer(this.layer);
      this.layer.dispose();
    }
    this.source?.dispose(); // Cannot reuse GeoTIFF.
  }

  async update(map: Map, image: ImgData) {
    console.log('Updating background');
    this.image = image;
    await image.promise;
    this.dispose(map);

    const urls = image.urls.map((url) => ({ url: url.url }));
    this.source = new GeoTIFF({
      normalize: this.image.mode === 'rgb',
      sources: urls
    });

    // Necessary to prevent openlayers bug. It assumes that all images have 4 channels.
    this.source.bandCount = this.image.mode === 'rgb' ? 3 : image.channels.length;
    this.layer = new WebGLTileLayer({
      style: Array.isArray(image.channels) ? genCompStyle(image.channels) : genRGBStyle(),
      source: this.source,
      zIndex: -1
    });

    this.mPerPx = image.mPerPx;
    map.addLayer(this.layer);

    // TODO: Persistent view when returning to same sample.
    this.source
      .getView()
      .then((v) => {
        return new View({
          ...v,
          resolutions: [...v.resolutions!, v.resolutions!.at(-1)! / 2, v.resolutions!.at(-1)! / 4]
        });
      })
      .then((v) => map.setView(v))
      .catch(console.error);
  }

  updateStyle(imgCtrl: CompCtrl | RGBCtrl) {
    if (!this.image) {
      console.error('No image loaded');
      return;
    }
    if (imgCtrl.type === 'rgb') {
      this._updateStyle(imgCtrl as Omit<RGBCtrl, 'type'>);
      return;
    }
    this._updateStyle(decomposeColors(this.image.channels as string[], imgCtrl));
  }

  _updateStyle = oneLRU((variables: Record<string, number>) => {
    this.layer?.updateStyleVariables(variables);
  });
}
