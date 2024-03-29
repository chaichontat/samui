import { throttle } from 'lodash-es';
import type { Map } from 'ol';
import WebGLTileLayer from 'ol/layer/WebGLTile';
import GeoTIFF from 'ol/source/GeoTIFF';
import type { ImgData } from '../../data/objects/image';
import { Deferrable } from '../../definitions';
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
      style: Array.isArray(image.channels)
        ? genCompStyle(image.channels, Math.round(image.maxVal / 2))
        : genRGBStyle(),
      source: this.source,
      zIndex: -1
    });

    this.mPerPx = image.mPerPx;
    map.addLayer(this.layer);
    // TODO: Assuming same channels.
  }

  updateStyle = throttle((imgCtrl: CompCtrl | RGBCtrl) => {
    if (!this.image) {
      console.error('No image loaded');
      return;
    }
    localStorage.setItem('imgCtrl', JSON.stringify(imgCtrl));
    if (imgCtrl.type === 'rgb') {
      this._updateStyle(imgCtrl as Omit<RGBCtrl, 'type'>);
    } else if (imgCtrl.type === 'composite') {
      this._updateStyle(decomposeColors(this.image.channels as string[], imgCtrl));
    } else {
      console.error('Unknown type');
    }
  }, 30);

  _updateStyle = (variables: Record<string, number>) => {
    console.debug('update style var');
    this.layer?.updateStyleVariables(variables);
  };
}
