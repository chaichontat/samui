import { View, type Map } from 'ol';
import WebGLTileLayer, { type Style } from 'ol/layer/WebGLTile.js';
import GeoTIFF from 'ol/source/GeoTIFF.js';
import type { Image } from '../data/image';
import { Deferrable, oneLRU } from '../utils';
import { genStyle } from './colormap';

export class Background extends Deferrable {
  name: string;
  source?: GeoTIFF;
  layer?: WebGLTileLayer;
  mode?: 'composite' | 'rgb';
  mPerPx?: number;

  constructor(name: string) {
    super();
    this.name = name;
  }

  mount() {
    if (!this.layer) {
      this.layer = new WebGLTileLayer({ zIndex: 0 });
    }
    this._deferred.resolve();
    return this;
  }

  async update(map: Map, image: Image) {
    console.log('Updating background');
    await image.promise;
    if (this.layer) {
      map.removeLayer(this.layer);
      this.layer.dispose();
    }

    const urls = image.urls.map((url) => ({ url: url.url }));
    this.source?.dispose(); // Cannot reuse GeoTIFF.
    this.source = new GeoTIFF({
      normalize: image.channel === 'rgb',
      sources: urls
    });

    this.mode = image.channel === 'rgb' ? 'rgb' : 'composite';
    const bandCount = (this.source.bandCount = this.mode === 'rgb' ? 3 : image.channel.length);
    // Verify correct bandCount.
    // this.source.on(
    //   'change',
    //   () =>
    //     this.source?.getState() === 'ready' &&
    //     this.source.bandCount !== bandCount &&
    //     alert(
    //       `Number of channels mismatch between config ${bandCount} and actual ${this.source.bandCount}.`
    //     )
    // );

    this.layer = new WebGLTileLayer({
      style: this._genBgStyle(image.channel),
      source: this.source,
      zIndex: -1
    });

    this.mPerPx = image.mPerPx;
    map.addLayer(this.layer);

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

  updateStyle = oneLRU((variables: Record<string, number>) => {
    this.layer?.updateStyleVariables(variables);
  });

  _genBgStyle(channel: 'rgb' | string[]): Style {
    if (channel === 'rgb') {
      return {
        variables: {
          Exposure: 0,
          Contrast: 0,
          Saturation: 0
        },
        exposure: ['var', 'Exposure'],
        contrast: ['var', 'Contrast'],
        saturation: ['var', 'Saturation']
      };
    } else {
      return genStyle(channel);
    }
  }
}
