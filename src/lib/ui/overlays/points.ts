import Feature from 'ol/Feature.js';
import { Circle, Geometry, Point } from 'ol/geom.js';

import type { Coord, CoordsData } from '$lib/data/objects/coords';
import {
  convertCategoricalToNumber,
  type FeatureAndGroup,
  type RetrievedData
} from '$src/lib/data/objects/feature';
import type { Sample } from '$src/lib/data/objects/sample';
import { keyLRU } from '$src/lib/lru';
import { FeatureLabel } from '$src/lib/sidebar/annotation/annoUtils';
import { sEvent, sFeatureData, sOverlay } from '$src/lib/store';
import { rand } from '$src/lib/utils';
import { isEqual } from 'lodash-es';
import { View } from 'ol';
import VectorLayer from 'ol/layer/Vector.js';
import WebGLPointsLayer from 'ol/layer/WebGLPoints.js';
import VectorSource from 'ol/source/Vector.js';
import { Fill, RegularShape, Stroke, Style } from 'ol/style.js';
import { get } from 'svelte/store';
import { MapComponent } from '../definitions';
import type { Mapp } from '../mapp';
import { genSpotStyle } from './featureColormap';

export class WebGLSpots extends MapComponent<WebGLPointsLayer<VectorSource<Point>>> {
  outline: CanvasSpots;
  _currStyle: string;
  uid: string;
  features?: Feature<Point>[];

  currSample?: string;
  currFeature?: FeatureAndGroup;
  currPx?: number;
  currLegend?: (string | number)[];
  currUnit?: string;

  // WebGLSpots only gets created after mount.
  constructor(map: Mapp) {
    super(map, genSpotStyle('categorical', 2));
    this.uid = rand();
    this._currStyle = 'categorical';
    this.outline = new CanvasSpots(this.map);
    this.outline.mount();
    this.outline.visible = false;
  }

  get currStyle() {
    return this._currStyle;
  }

  set currStyle(style: string) {
    if (!this.coords) throw new Error('Must run update first.');
    if (style === this._currStyle && this.currPx === this.coords.sizePx) return;

    switch (style) {
      case 'quantitative':
        this.style = genSpotStyle('quantitative', this.coords.sizePx);
        break;
      case 'categorical':
        this.style = genSpotStyle('categorical', this.coords.sizePx);
        break;
      default:
        throw new Error(`Unknown style: ${style}`);
    }

    this._currStyle = style;
    this.currPx = this.coords.sizePx;
    this._rebuildLayer().catch(console.error);
  }

  updateMask(mask: boolean[]) {
    if (!this.features) {
      console.error('No features to update');
      return;
    }
    if (mask.length !== this.features.length) {
      throw new Error('Mask length does not match features');
    }

    for (const [i, f] of this.features.entries()) {
      f.set('opacity', mask[i] ? 1 : 0.15);
    }
  }

  _updateProperties(sample: Sample, fn: FeatureAndGroup, { dataType, data }: RetrievedData) {
    if (!data) throw new Error('No intensity provided');
    if (!this.features) throw new Error('No features to update');
    console.debug(`Updating ${this.uid} to ${fn.feature}.`);

    // TODO: Subsample if coords subsampled.
    if (data?.length !== this.features.length) {
      console.error(
        `Intensity length doesn't match. Expected: ${this.source?.getFeatures().length}, got: ${
          data?.length
        }`
      );
      return false;
    }

    // Set style categorical or quantitative.
    if (dataType === 'categorical') {
      ({ legend: this.currLegend, converted: data } = convertCategoricalToNumber({
        key: `${sample.name}-${fn.group}-${fn.feature}`,
        args: [data]
      }));
    } else {
      this.currLegend = undefined;
    }

    this.currStyle = dataType;

    for (const [i, f] of this.features.entries()) {
      f.set('value', data[i]); // Cannot use silent. Update seems specific to each feature and value.
      f.set('opacity', 1);
    }
    this.layer?.changed();
  }

  async _rebuildLayer() {
    await this.map.promise;
    const newLayer = new WebGLPointsLayer({
      source: this.source as VectorSource<Point>,
      style: this.style,
      zIndex: 10
    });

    const prev = this.layer;
    this.map.map!.addLayer(newLayer);
    if (prev) {
      this.map.map!.removeLayer(prev);
      prev.dispose();
    }
    this.layer = newLayer;
    console.debug(`Overlay ${this.uid} rebuilt.`);
  }

  async update(sample: Sample, fn: FeatureAndGroup) {
    console.debug(`Update called: ${this.uid} to ${fn.feature}.`);
    if (!fn.feature) return false;
    const res = await sample.getFeature(fn);
    if (!res) return false;

    const { data, dataType, coords } = res;
    // Check if coord is the same.
    if ((this.currSample !== sample.name || this.coords?.name) !== coords.name) {
      this.source.clear();
      this.features = this.genPoints({
        key: `${sample.name}-${coords.name}`,
        args: [coords]
      });
      this.coords = coords;

      // Set the view to new coords when no image is available.
      if (this.map._needNewView) {
        let mx = 0;
        let my = 0;
        const max = [0, 0];
        const min = [0, 0];
        for (const { x, y } of coords.pos!) {
          const xx = Number(x);
          const yy = -Number(y);
          mx += xx;
          my += yy;
          min[0] = Math.min(min[0], xx);
          min[1] = Math.min(min[1], yy);
          max[0] = Math.max(max[0], xx);
          max[1] = Math.max(max[1], yy);
        }
        mx /= res.data.length;
        my /= res.data.length;

        // From the 128x division of the highest tile level.
        // The same number of resolutions is needed to maintain correct ratios for WebGLPointsLayer.
        // 10 layers of tiling.
        const start = coords.mPerPx * 128;
        const ress = [...Array(10).keys()].map((i) => start * 2 ** -i);

        // Such that the entire sample is covered in 2**9 = 512 px.
        // 8 due to the 4x native res max zoom.
        // Using nearest power of 2.
        let minZoom: number;
        {
          // Round up to nearest power of 2.
          const orderof2 = 32 - Math.clz32(Math.max(max[0] - min[0], max[1] - min[1]));
          minZoom = Math.max(0, 8 - Math.max(0, orderof2 - 9));
        }

        // Limit extent to 1.5x size of the sample.
        const range = [(max[1] - min[1]) * coords.mPerPx, (max[0] - min[0]) * coords.mPerPx];
        this.map.map!.setView(
          new View({
            center: [mx * coords.mPerPx, my * coords.mPerPx],
            extent: [
              min[0] * coords.mPerPx - range[0] / 2,
              min[1] * coords.mPerPx - range[1] / 2,
              max[0] * coords.mPerPx + range[0] / 2,
              max[1] * coords.mPerPx + range[1] / 2
            ],
            projection: 'EPSG:3857',
            resolutions: ress,
            zoom: minZoom + 1,
            minZoom
          })
        );
        this.map._needNewView = false;
      }
    }

    if (this.currSample !== sample.name || !isEqual(this.currFeature, fn)) {
      this._updateProperties(sample, fn, { dataType, data });
      this.currFeature = fn;
      this.currSample = sample.name;
    }

    // Tell WebGL to update. Intentionally not updating on source directly to minimize redraws.
    this.source.getFeatures().length === 0
      ? this.source.addFeatures(this.features!)
      : this.source.changed();

    this.currUnit = res.unit;
    this.outline.updateSample(coords);

    // When changing between samples, all overlays are updated.
    if (get(sOverlay) === this.uid) {
      sFeatureData.set({ ...res, name: fn });
      sEvent.set({ type: 'featureUpdated' });
    }
    return res;
  }

  async updateSample(sample: Sample) {
    if (!this.currFeature) return false;
    return await this.update(sample, this.currFeature);
  }

  dispose() {
    if (this.outline) this.outline.dispose();
    super.dispose();
  }

  // Do not use static, LRU would be linked between instances.
  genPoints = keyLRU((coords: CoordsData) => {
    return coords.pos!.map(({ x, y, id, idx }) => {
      const f = new Feature({
        geometry: new Point([x * coords.mPerPx, -y * coords.mPerPx]),
        value: 0,
        id: id ?? idx
      });
      f.setId(idx);
      return f;
    });
  });
}

// TODO: Combine activespots and canvasspots
export class ActiveSpots extends MapComponent<VectorLayer<VectorSource<Geometry>>> {
  readonly feature: Feature<Circle>;

  constructor(map: Mapp) {
    super(
      map,
      new Style({
        stroke: new Stroke({ color: '#ffffff', width: 1 }),
        fill: new Fill({ color: 'transparent' })
      })
    );
    this.feature = new Feature({
      geometry: new Circle([0, 0]),
      value: 0
    });
    this.layer = new VectorLayer({
      source: new VectorSource({ features: [this.feature] }),
      zIndex: Infinity,
      style: this.style
    });
  }

  mount() {
    this.map.map!.addLayer(this.layer!);
    this._deferred.resolve();
    return this;
  }

  update(coords: CoordsData, idx: number) {
    this.visible = true;
    if (!coords.mPerPx) throw new Error('No mPerPx provided');
    const pos = coords.pos!.find((p) => p.idx === idx);
    if (!pos) {
      console.error(`No position found for idx ${idx}`);
      return;
    }

    const { x, y, id } = pos;
    const size = coords.size ? coords.size / 2 : coords.mPerPx * 10;
    this.feature.getGeometry()?.setCenterAndRadius([x * coords.mPerPx, -y * coords.mPerPx], size);
    this.feature.set('id', id);
    this.feature.setId(idx);
  }
}

export class BaseSpots extends MapComponent<VectorLayer<VectorSource<Geometry>>> {
  constructor(map: Mapp, style?: Style) {
    super(
      map,
      style ??
        new Style({
          stroke: new Stroke({ color: '#ffffff66', width: 1 }),
          fill: new Fill({ color: 'transparent' })
        })
    );
    this.layer = new VectorLayer({
      source: this.source,
      style: this.style
    });
  }

  mount() {
    this.map.map!.addLayer(this.layer!);
    this._deferred.resolve();
    return this;
  }

  static _genCircle({
    x,
    y,
    id,
    idx,
    mPerPx,
    size
  }: Coord & { idx: number; mPerPx: number; size?: null }): FeatureLabel<Point>;

  static _genCircle({
    x,
    y,
    id,
    idx,
    mPerPx,
    size
  }: Coord & { idx: number; mPerPx: number; size: number }): FeatureLabel<Circle>;

  static _genCircle({
    x,
    y,
    id,
    idx,
    mPerPx,
    size
  }: Coord & { idx: number; mPerPx: number; size?: number | null }):
    | FeatureLabel<Point>
    | FeatureLabel<Circle> {
    const c = [x * mPerPx, -y * mPerPx];
    const f = new FeatureLabel({
      geometry: size != undefined && size != undefined ? new Circle(c, size / 2) : new Point(c),
      value: 0,
      id: id ?? idx
    });
    f.setId(idx);
    return f as FeatureLabel<Point> | FeatureLabel<Circle>;
  }

  get(idx: number) {
    return this.source.getFeatureById(idx);
  }
}

export class CanvasSpots extends BaseSpots {
  currCoordName?: string;

  get visible() {
    return this.layer!.getVisible();
  }

  set visible(visible: boolean) {
    if (!this.layer) throw new Error('No layer');
    if (visible) {
      this.update_();
    }
    this.layer.setVisible(visible);
  }

  /// Replace entire feature.
  update(coords: CoordsData) {
    this.coords = coords;
    if (this.visible) {
      this.update_();
    }
  }

  updateSample(coords: CoordsData) {
    // Clear old coords.
    this.currCoordName = undefined;
    this.update(coords);
  }

  update_() {
    if (!this.coords) {
      console.error('No coords. Probably bc points > 10000. Disabled for performance reasons.');
      return;
    }
    if (this.currCoordName === this.coords.name) return;

    console.debug('Updating canvasSpots (probably outline)');
    if (this.coords.mPerPx == undefined) throw new Error('mPerPx undefined.');

    this.source.clear();
    const shortEnough = this.coords.pos!.length < 10000;
    if (!shortEnough) {
      return;
    }

    this.source.addFeatures(
      this.coords.pos!.map((c) =>
        CanvasSpots._genCircle({ ...c, mPerPx: this.coords.mPerPx, size: this.coords.size })
      )
    );
    this.currCoordName = this.coords.name;
  }
}
