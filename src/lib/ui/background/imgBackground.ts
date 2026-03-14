import { throttle } from 'lodash-es';
import type { Map } from 'ol';
import type ViewOptions from 'ol/View.js';
import WebGLTileLayer from 'ol/layer/WebGLTile';
import DataTileSource from 'ol/source/DataTile.js';
import GeoTIFF from 'ol/source/GeoTIFF';
import { sEvent } from '$lib/store';
import type { ImgData } from '../../data/objects/image';
import { registerTiffCodecs } from '../../data/tiffCodecs';
import { Deferrable } from '../../definitions';
import { buildCompositeController, restoreCompositeController } from './imgControlState';
import { estimateCompositeMinMax } from './imgIntensity';
import {
  buildLocalTiffViewOptions,
  createLocalTiffSource,
  isLocalTiffImage
} from './localTiffSource';
import {
  decomposeColors,
  genCompStyle,
  genRGBStyle,
  type CompCtrl,
  type RGBCtrl
} from './imgColormap';

registerTiffCodecs();

export class Background extends Deferrable {
  source?: GeoTIFF | DataTileSource;
  geoTiffSource?: GeoTIFF;
  layer?: WebGLTileLayer;
  mPerPx?: number;
  image?: ImgData;
  viewOptions?: ViewOptions;
  intensityRequestId = 0;

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
    this.source = undefined;
    this.layer = undefined;
    this.geoTiffSource = undefined;
    this.image = undefined;
    this.mPerPx = undefined;
    this.viewOptions = undefined;
    this.intensityRequestId += 1;
  }

  async update(map: Map, image: ImgData) {
    console.log('Updating background');
    await image.promise;
    this.dispose(map);
    this.image = image;
    if (isLocalTiffImage(image)) {
      this.source = await createLocalTiffSource(image);
      this.viewOptions = buildLocalTiffViewOptions(image);
    } else {
      const urls = image.urls.map((url) => ({ url: url.url }));
      this.geoTiffSource = new GeoTIFF({
        normalize: this.image.mode === 'rgb',
        sources: urls
      });

      // Necessary to prevent openlayers bug. It assumes that all images have 4 channels.
      this.geoTiffSource.bandCount = this.image.mode === 'rgb' ? 3 : image.channels.length;
      this.source = this.geoTiffSource;
    }

    this.layer = new WebGLTileLayer({
      style: Array.isArray(image.channels)
        ? genCompStyle(image.channels, Math.round(image.maxVal / 2), image.defaultMinMax)
        : genRGBStyle(),
      source: this.source,
      zIndex: -1
    });

    this.mPerPx = image.mPerPx;
    map.addLayer(this.layer);

    if (Array.isArray(image.channels) && Object.keys(image.defaultMinMax).length === 0) {
      const requestId = ++this.intensityRequestId;
      void this.applyEstimatedDefaults(image, requestId);
    }
    // TODO: Assuming same channels.
  }

  private async applyEstimatedDefaults(image: ImgData, requestId: number) {
    try {
      const defaultMinMax = await estimateCompositeMinMax(image);
      if (requestId !== this.intensityRequestId || this.image !== image) {
        return;
      }

      image.defaultMinMax = defaultMinMax;

      const restored = restoreCompositeController(image.channels);
      if (restored) {
        return;
      }

      this.updateStyle(buildCompositeController(image));
      sEvent.set({ type: 'imgDefaultsUpdated' });
    } catch (error) {
      console.error('Failed to estimate composite image intensity defaults.', error);
    }
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
