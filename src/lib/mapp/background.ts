import { View, type Map } from 'ol';
import WebGLTileLayer, { type Style } from 'ol/layer/WebGLTile.js';
import GeoTIFF from 'ol/source/GeoTIFF.js';
import type { Image } from '../data/image';
import { Deferrable } from '../utils';
import type { MapComponent } from './mapp';

export class Background extends Deferrable implements MapComponent {
  source?: GeoTIFF;
  layer?: WebGLTileLayer;
  mode?: 'composite' | 'rgb';
  mPerPx?: number;

  constructor() {
    super();
  }

  mount(): void {
    if (!this.layer) {
      this.layer = new WebGLTileLayer({});
    }
    this._deferred.resolve();
  }

  async update(map: Map, image: Image) {
    await image.promise;
    if (this.layer) {
      map.removeLayer(this.layer);
      this.layer.dispose();
    }
    if (this.source) {
      this.source.dispose(); // Cannot reuse GeoTIFF.
    }

    const urls = image.urls.map((url) => ({ url: url.url }));
    this.source = new GeoTIFF({
      normalize: image.channel === 'rgb',
      sources: urls
    });

    this.mode = image.channel === 'rgb' ? 'rgb' : 'composite';
    this.layer = new WebGLTileLayer({
      style: this._genBgStyle(this.mode),
      source: this.source
    });

    this.mPerPx = image.mPerPx;
    map.addLayer(this.layer);
    const view = this.source.getView();
    view
      .then((v) => {
        return new View({
          ...v,
          resolutions: [...v.resolutions!, v.resolutions!.at(-1)! / 2, v.resolutions!.at(-1)! / 4]
        });
      })
      .then((v) => map.setView(v))
      .catch(console.error);
  }

  updateStyle(variables: Record<string, number>) {
    this.layer?.updateStyleVariables(variables);
  }

  _genBgStyle(mode: 'composite' | 'rgb'): Style {
    switch (mode) {
      case 'composite':
        return {
          variables: {
            blue: 1,
            green: 1,
            red: 1,
            blueMax: 128,
            greenMax: 128,
            redMax: 128,
            blueMask: 1,
            greenMask: 1,
            redMask: 1
          },
          color: [
            'array',
            ['*', ['/', ['band', ['var', 'red']], ['var', 'redMax']], ['var', 'redMask']],
            ['*', ['/', ['band', ['var', 'green']], ['var', 'greenMax']], ['var', 'greenMask']],
            ['*', ['/', ['band', ['var', 'blue']], ['var', 'blueMax']], ['var', 'blueMask']],
            1
          ]
        };
      case 'rgb':
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
      default:
        throw new Error(`Unknown image mode`);
    }
  }
}
