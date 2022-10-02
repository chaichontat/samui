import { annotating, sFeatureData } from '$src/lib/store';
import { schemeTableau10 } from 'd3';
import { Feature } from 'ol';
import type { Coordinate } from 'ol/coordinate.js';
import { Polygon } from 'ol/geom.js';
import { Draw, Modify } from 'ol/interaction.js';
import type { DrawEvent } from 'ol/interaction/Draw';
import type { ModifyEvent } from 'ol/interaction/Modify';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import { Fill, Stroke, Style, Text } from 'ol/style.js';
import { get } from 'svelte/store';
import type { Mapp } from '../../ui/mapp';
import type { MutableSpots } from '../../ui/overlays/points';
import { rand } from '../../utils';

export type Geometries = 'Polygon' | 'Circle' | 'Point';
export type ROIData = {
  name: string;
  type: Geometries;
  color?: string;
  coords: Coordinate[][];
  properties?: Record<string, any>;
};

export class Draww {
  draw: Draw;
  // snap: Snap;
  modify: Modify;
  currDrawType: Geometries = 'Polygon';
  readonly source: VectorSource<Polygon>;
  readonly selectionLayer: VectorLayer<typeof this.source>;

  readonly map: Mapp;
  readonly featuresBeforeMod: Record<number, Feature<Polygon>> = {};

  _currHighlight: number | null = null;
  _colorCounter = 0; // Ensures that color increases when deleting older selections.

  constructor(map: Mapp) {
    this.source = new VectorSource();
    this.map = map;

    this.selectionLayer = new VectorLayer({ source: this.source });
    this.draw = new Draw({ type: 'Polygon', source: this.source });
    this.modify = new Modify({ source: this.source });
    // this.snap = new Snap({ source: this.source });
  }

  changeDrawType(type: 'Polygon' | 'Circle' | 'Point', first = false) {
    if (type === this.currDrawType && !first) return;

    if (this.draw) this.map.map!.removeInteraction(this.draw);
    // if (this.snap) this.map.map!.removeInteraction(this.snap);
    // this.snap?.dispose();
    this.draw?.dispose();

    this.draw = new Draw({
      type,
      source: this.source,
      // condition: platformModifierKeyOnly,
      // freehandCondition: shiftKeyOnly,
      style: new Style({
        fill: new Fill({ color: 'rgba(255, 255, 255, 0.3)' }),
        stroke: new Stroke({ color: '#d946ef', width: 3 })
      }),
      stopClick: true
    });

    this.draw.on('drawend', (event: DrawEvent) => {
      event.preventDefault();
      // this.points.remove(-1);
      this.processFeature(event.feature as Feature<Polygon>, schemeTableau10[this._colorCounter++]);
    });

    // this.snap = new Snap({ source: this.source });
    // this.map.map!.addInteraction(this.snap);
    this.currDrawType = type;
  }

  mount() {
    this.changeDrawType('Polygon', true);
    this.map.map!.addInteraction(this.modify);
    this.map.map!.addLayer(this.selectionLayer);
    this.selectionLayer.setZIndex(Infinity);
  }

  clear() {
    this.source.clear();
  }

  update(template: Feature[]) {
    this.clear();
    // this.points.update(template);
  }

  processFeature(feature: Feature<Polygon>, color: string, name = '') {
    // Not called after modify.
    feature.setId(rand());
    feature.on(
      'propertychange',
      (e) => (e.key === 'name' || e.key === 'color') && this._updatePolygonStyle(feature)
    );

    feature.set('color', color);
    feature.set('name', name);
    console.log(feature);
  }

  highlightPolygon(i: number | null) {
    if (i == undefined) throw new Error('i is undefined');
    this.unhighlightPolygon();
    if (i == undefined) return;
    const feat = this.source.getFeatures().at(i);
    if (!feat) throw new Error('No feature at index ' + i.toString());
    this._currHighlight = i;
    // this._updatePolygonStyle(feat, );
  }

  unhighlightPolygon() {
    if (this._currHighlight == undefined) return;
    const feat = this.source.getFeatures().at(this._currHighlight);
    if (!feat) throw new Error('No feature at index ' + this._currHighlight.toString());

    // this._updatePolygonStyle(feat);
  }

  // Need to rerun on name change.
  _updatePolygonStyle(feature: Feature<Polygon>, setStroke = true) {
    const st = drawnStyle.clone();
    if (setStroke) {
      st.setStroke(new Stroke({ color: feature.get('color') as string, width: 3 }));
    }
    st.getText().setText(feature.get('name') as string);
    feature.setStyle(st);
  }

  deletePolygon(i: number) {
    this.source.removeFeature(this.source.getFeatures()[i]);
  }

  dump() {
    const out: ROIData[] = [];
    for (const feature of this.source.getFeatures()) {
      const g = feature.getGeometry();
      if (!g) continue;
      const coords = g
        .getCoordinates()
        .map((coord) => coord.map((c) => c.map((x) => x.toExponential(4))));

      if (g)
        out.push({
          name: feature.get('name') as string,
          type: 'Polygon',
          color: feature.get('color') as string,
          // @ts-ignore
          coords: coords, // String here but will be converted to number once out in JSON.
          properties: (({ name, color, ...o }) => o)(g.getProperties()) // Remove name and color.
        });
    }
    return out;
  }

  loadPolygons(cs: ROIData[]) {
    for (const { name, color, coords, properties } of cs) {
      const feature = new Feature({ geometry: new Polygon(coords) });
      this.processFeature(feature, color ?? schemeTableau10[this._colorCounter++ % 10], name);
      if (properties) feature.setProperties(properties);
      this.source.addFeature(feature);
    }
  }

  /// To be used when renaming.
  refresh() {
    this.source.forEachFeature((f) => this._updatePolygonStyle(f));
  }
}

const textStyle = new Text({
  font: '16px sans-serif',
  fill: new Fill({
    color: '#000'
  }),
  stroke: new Stroke({
    color: '#fff',
    width: 4
  })
});
// Style for finished polygon.
const drawnStyle = new Style({
  stroke: new Stroke({ color: '#00ffe9', width: 3 }),
  text: textStyle
});

export class DrawFeature extends Draww {
  readonly points: MutableSpots;
  constructor(map: Mapp, mutspot: MutableSpots) {
    super(map);
    this.points = mutspot;
  }

  mount() {
    super.mount();
    this.points.mount();
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

  clear() {
    super.clear();
    this.points.clear();
  }

  processFeature(feature: Feature<Polygon>, color: string, name?: string): void {
    // Not called after modify.
    // const keyIdx = get(annotating).currKey;
    // if (points && keyIdx == undefined) throw new Error('keyIdx is null');

    feature.set('color', color);
    feature.set('name', name);
    // feature.setId(rand());
    // feature.on('propertychange', (e) => {
    //   if (e.key === 'keyIdx' || e.key === 'color') {
    //     this._updatePolygonStyle(feature);
    //   }
    // });

    this.featuresBeforeMod[feature.getId() as number] = feature.clone();
    console.log(feature);
    // this._updatePolygonStyle(feature);

    this.points.addFromPolygon(
      feature,
      get(annotating).keys[keyIdx],
      get(sFeatureData).coords,
      get(annotating).keys
    );
  }

  deletePolygon(i: number): void {
    const feature = this.source.getFeatures()[i];
    this.source.removeFeature(feature);
    // this.points.remove(uid);
  }
}
