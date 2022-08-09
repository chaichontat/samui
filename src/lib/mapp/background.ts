import { View, type Map } from 'ol';
import WebGLTileLayer, { type Style } from 'ol/layer/WebGLTile.js';
import GeoTIFF from 'ol/source/GeoTIFF.js';
import type { Image } from '../data/image';
import { Deferrable, oneLRU } from '../utils';
import type { MapComponent } from './definitions';

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
      style: this._genBgStyle(this.mode),
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
