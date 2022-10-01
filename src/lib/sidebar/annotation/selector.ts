import { annotating, sEvent, sFeatureData } from '$src/lib/store';
import { schemeTableau10 } from 'd3';
import { Feature, type Map } from 'ol';
import type { Coordinate } from 'ol/coordinate.js';
import { Polygon } from 'ol/geom.js';
import { Draw, Modify, Snap } from 'ol/interaction.js';
import type { DrawEvent } from 'ol/interaction/Draw';
import type { ModifyEvent } from 'ol/interaction/Modify';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import { Fill, Stroke, Style, Text } from 'ol/style.js';
import { get } from 'svelte/store';
import type { Mapp } from '../../ui/mapp';
import type { MutableSpots } from '../../ui/overlays/points';
import { rand, type Named } from '../../utils';

export class Draww {
  draw?: Draw;
  snap!: Snap;
  modify: Modify;
  currDrawType: 'Polygon' | 'Circle' | 'Point' = 'Polygon';
  readonly source: VectorSource<Polygon>;
  readonly selectionLayer: VectorLayer<typeof this.source>;
  readonly points: MutableSpots;
  readonly map: Mapp;
  readonly featuresBeforeMod: Record<number, Feature<Polygon>> = {};

  _currHighlight: number | null = null;
  _colorCounter = 0; // Ensures that color increases when deleting older selections.

  // Style for finished polygon.
  style: Style = new Style({
    stroke: new Stroke({ color: '#00ffe9', width: 3 }),
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
    this.map = map;

    this.selectionLayer = new VectorLayer({
      source: this.source
    });

    this.points = mutspot;

    this.modify = new Modify({ source: this.source });
  }

  changeDrawType(type: 'Polygon' | 'Circle' | 'Point', first = false) {
    if (type === this.currDrawType && !first) return;

    if (this.draw) this.map.map!.removeInteraction(this.draw);
    if (this.snap) this.map.map!.removeInteraction(this.snap);

    this.snap?.dispose();
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
      this._afterDraw(event.feature as Feature<Polygon>);
    });

    this.snap = new Snap({ source: this.source });
    this.map.map!.addInteraction(this.draw);
    this.map.map!.addInteraction(this.snap);
    this.currDrawType = type;
  }

  mount() {
    this.changeDrawType('Polygon', true);
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

  _afterDraw(feature: Feature<Polygon>, points = true) {
    // Not called after modify.
    const keyIdx = get(annotating).currKey;
    if (points && keyIdx == undefined) throw new Error('keyIdx is null');

    feature.set(
      'color',
      schemeTableau10[points ? keyIdx % 10 : this.source.getFeatures().length % 10]
    );
    feature.set('keyIdx', keyIdx);
    feature.setId(rand());
    feature.on('propertychange', (e) => {
      if (e.key === 'keyIdx' || e.key === 'color') {
        this._updatePolygonStyle(feature);
      }
    });

    this.featuresBeforeMod[feature.getId() as number] = feature.clone();
    console.log(feature);
    this._updatePolygonStyle(feature);

    if (points) {
      this.points.addFromPolygon(
        feature,
        get(annotating).keys[keyIdx],
        get(sFeatureData).coords,
        get(annotating).keys
      );
    }
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
      // st.setFill(new Fill({ color: 'rgba(255, 255, 255, 0.1)' }));
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

  dump() {
    const out: { name: string; coords: string[][][]; properties: Record<string, any> }[] = [];
    const keys = get(annotating).keys;

    for (const feature of this.source.getFeatures()) {
      const g = feature.getGeometry();
      if (!g) continue;
      const coords = g
        .getCoordinates()
        .map((coord) => coord.map((c) => c.map((x) => x.toExponential(4))));

      if (g)
        out.push({
          name: keys[feature.get('keyIdx') as number],
          coords,
          properties: g.getProperties()
        });
    }
    return out;
  }

  getPoints(i: number) {
    const feat = this.source.getFeatures()[i];
    const uid = feat.getId() as number;
    // return this.points.dump(uid);
  }

  loadPolygons(cs: Named<Coordinate[][]>[]) {
    // this.clear();
    for (const { name, values } of cs) {
      const feature = new Feature({ geometry: new Polygon(values) });
      feature.set('name', name);
      this._afterDraw(feature, false);
      this.source.addFeature(feature);
    }
  }

  /// To be used when renaming.
  refresh() {
    this.source.forEachFeature((f) => this._updatePolygonStyle(f));
  }
}
