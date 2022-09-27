import { annotating, sFeatureData } from '$src/lib/store';
import { schemeTableau10 } from 'd3';
import { Feature, type Map } from 'ol';
import type { Coordinate } from 'ol/coordinate.js';
import { Polygon } from 'ol/geom.js';
import { Draw, Modify } from 'ol/interaction.js';
import type { DrawEvent } from 'ol/interaction/Draw';
import type { ModifyEvent } from 'ol/interaction/Modify';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import { Fill, Stroke, Style, Text } from 'ol/style.js';
import { get } from 'svelte/store';
import { rand, type Named } from '../../utils';
import type { Mapp } from '../mapp';
import type { MutableSpots } from './points';

export class Draww {
  readonly draw: Draw;
  readonly source: VectorSource<Polygon>;
  readonly selectionLayer: VectorLayer<typeof this.source>;
  readonly points: MutableSpots;
  readonly modify: Modify;
  readonly map: Mapp;
  readonly featuresBeforeMod: Record<number, Feature<Polygon>> = {};

  _currHighlight: number | null = null;
  _colorCounter = 0; // Ensures that color increases when deleting older selections.

  // Style for finished polygon.
  style: Style = new Style({
    stroke: new Stroke({ color: '#00ffe9', width: 2 }),
    text: new Text({
      font: '16px sans-serif',
      fill: new Fill({
        color: '#000'
      }),
      stroke: new Stroke({
        color: '#fff',
        width: 4
      })
    })
  });

  constructor(map: Mapp, mutspot: MutableSpots) {
    this.source = new VectorSource();
    // Style for drawing polygons.
    this.draw = new Draw({
      type: 'Polygon',
      source: this.source,
      // condition: platformModifierKeyOnly,
      // freehandCondition: shiftKeyOnly,
      style: new Style({
        fill: new Fill({ color: 'rgba(255, 255, 255, 0.1)' }),
        stroke: new Stroke({ color: '#00ffe9', width: 2 })
      }),
      stopClick: true
    });

    this.map = map;

    this.selectionLayer = new VectorLayer({
      source: this.source
    });

    this.points = mutspot;
    this.modify = new Modify({ source: this.source });

    this._attachDraw();
  }

  mount() {
    this._attachModify(this.map.map!);
    this.points.mount();
    this.map.map!.addLayer(this.selectionLayer);
    this.selectionLayer.setZIndex(Infinity);
  }

  clear() {
    this.source.clear();
    this.points.clear();
  }

  update(template: Feature[]) {
    this.clear();
    // this.points.update(template);
  }

  _attachDraw() {
    this.draw.on('drawend', (event: DrawEvent) => {
      event.preventDefault();
      // this.points.remove(-1);
      this._afterDraw(event.feature as Feature<Polygon>);
    });
  }

  _afterDraw(feature: Feature<Polygon>) {
    // Not called after modify.
    const keyIdx = get(annotating).currKey;
    if (keyIdx == undefined) throw new Error('keyIdx is null');

    feature.set('color', schemeTableau10[keyIdx % 10]);
    feature.set('keyIdx', keyIdx);
    feature.setId(rand());
    feature.on('propertychange', (e) => {
      if (e.key === 'keyIdx' || e.key === 'color') {
        this._updatePolygonStyle(feature);
      }
    });

    this.featuresBeforeMod[feature.getId() as number] = feature.clone();
    this._updatePolygonStyle(feature);
    this.points.addFromPolygon(
      feature,
      get(annotating).keys[keyIdx],
      get(sFeatureData).coords,
      get(annotating).keys
    );
  }

  _attachModify(map: Map) {
    map.addInteraction(this.modify);
    this.modify.on('modifyend', (e: ModifyEvent) => {
      console.debug('modifyend');
      const keyIdx = get(annotating).currKey;
      if (keyIdx == undefined) throw new Error('keyIdx is null');

      const feature = e.features.getArray()[0] as Feature<Polygon>;
      const idx = feature.getId() as number;
      feature.set('color', schemeTableau10[keyIdx % 10]);
      feature.set('keyIdx', keyIdx);
      const prev = this.featuresBeforeMod[idx];
      this.points.deleteFromPolygon(prev);
      this.points.addFromPolygon(
        feature,
        get(annotating).keys[keyIdx],
        get(sFeatureData).coords,
        get(annotating).keys
      );

      this.featuresBeforeMod[idx] = feature.clone();
    });
  }

  highlightPolygon(i: number | null) {
    if (i == undefined) throw new Error('i is undefined');
    this.unhighlightPolygon();
    if (i == undefined) return;
    const feat = this.source.getFeatures().at(i);
    if (!feat) throw new Error('No feature at index ' + i.toString());
    this._currHighlight = i;
    this._updatePolygonStyle(feat, false);
  }

  unhighlightPolygon() {
    if (this._currHighlight == undefined) return;
    const feat = this.source.getFeatures().at(this._currHighlight);
    if (!feat) throw new Error('No feature at index ' + this._currHighlight.toString());
    this._updatePolygonStyle(feat);
  }

  // Need to rerun on name change.
  _updatePolygonStyle(feature: Feature<Polygon>, setStroke = true) {
    const st = this.style.clone();
    if (setStroke) {
      st.setStroke(new Stroke({ color: feature.get('color') as `#${string}`, width: 2 }));
    } else {
      st.setFill(new Fill({ color: 'rgba(255, 255, 255, 0.1)' }));
    }
    st.getText().setText(get(annotating).keys[feature.get('keyIdx') as number]);
    feature.setStyle(st);
  }

  deletePolygon(i: number) {
    const feature = this.source.getFeatures()[i];
    const uid = feature.getId() as number;
    this.source.removeFeature(feature);
    // this.points.remove(uid);
  }

  dumpPolygons() {
    const out: Named<Coordinate[][]>[] = [];
    const keys = get(annotating).keys;
    for (const feature of this.source.getFeatures()) {
      const g = feature.getGeometry();
      if (g) out.push({ name: keys[feature.get('keyIdx') as number], values: g.getCoordinates() });
    }
    return out;
  }

  getPoints(i: number) {
    const feat = this.source.getFeatures()[i];
    const uid = feat.getId() as number;
    // return this.points.dump(uid);
  }

  loadPolygons(cs: Named<Coordinate[][]>[]) {
    this.clear();
    for (const { name, values } of cs) {
      const feature = new Feature({ geometry: new Polygon(values) });
      feature.set('name', name);
      this._afterDraw(feature);
      this.source.addFeature(feature);
    }
  }

  /// To be used when renaming.
  refresh() {
    this.source.forEachFeature((f) => this._updatePolygonStyle(f));
  }
}
