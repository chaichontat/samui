import { annoFeat, annoROI, sEvent, sFeatureData } from '$src/lib/store';
import { schemeTableau10 } from 'd3';
import { Feature } from 'ol';
import type { Coordinate } from 'ol/coordinate.js';
import { Circle, Geometry, Point, Polygon } from 'ol/geom.js';
import { Draw, Modify, Select, Snap, Translate } from 'ol/interaction.js';
import type { DrawEvent } from 'ol/interaction/Draw';
import type { ModifyEvent } from 'ol/interaction/Modify';
import type { SelectEvent } from 'ol/interaction/Select';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import { Fill, Stroke, Style, Text } from 'ol/style.js';
import CircleStyle from 'ol/style/Circle';
import { get } from 'svelte/store';
import type { Mapp } from '../../ui/mapp';
import type { MutableSpots } from '../../ui/overlays/points';
import { rand } from '../../utils';

export type Geometries = 'Polygon' | 'Circle' | 'Point';
export type ROIData = {
  name: string;
  type: Geometries;
  color?: string;
  coords: Coordinate[][] | Coordinate;
  radius?: number;
  properties?: Record<string, any>;
};

export class Draww {
  draw: Draw;
  snap: Snap;
  store: typeof annoROI;
  modify: Modify;
  select: Select;
  translate: Translate;
  currDrawType: Geometries = 'Polygon';
  readonly source: VectorSource<Geometry>;
  readonly selectionLayer: VectorLayer<typeof this.source>;

  readonly map: Mapp;

  _currHighlight: number | null = null;
  _colorCounter = 0; // Ensures that color increases when deleting older selections.

  constructor(map: Mapp, store: typeof annoROI) {
    this.source = new VectorSource();
    this.map = map;
    this.store = store
    this.selectionLayer = new VectorLayer({ source: this.source });
    this.draw = new Draw({ type: 'Polygon', source: this.source });
    this.select = new Select({ layers: [this.selectionLayer], style: initialStyle });
    this.modify = new Modify({ source: this.source });
    this.translate = new Translate({ features: this.select.getFeatures() });
    this.snap = new Snap({ source: this.source });
  }

  mount() {
    this.changeDrawType('Polygon', true);
    this.map.map!.addInteraction(this.modify);
    this.map.map!.addLayer(this.selectionLayer);
    this.selectionLayer.setZIndex(Infinity);
    this.map.map!.addInteraction(this.select);
    this.select.on('select', (ev: SelectEvent) => {
      document.addEventListener('keydown', (e) => {
        switch (e.key) {
          case 'Escape':
            this.select.getFeatures().clear();
            break;
          case 'Delete':
            for (const s of ev.selected) {
              this.removeFeature(s);
            }
            this.select.getFeatures().clear();
            break;
          case 'Backspace':
            for (const s of ev.selected) {
              this.removeFeature(s);
            }
            this.select.getFeatures().clear();
            break;
        }
      });
    });
    this.map.map!.addInteraction(this.translate);
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
      style: initialStyle,
      stopClick: true
    });

    this.draw.on('drawend', (e) => this.onDrawEnd_(e));

    this.snap = new Snap({ source: this.source });
    this.map.map!.addInteraction(this.snap);
    this.currDrawType = type;
  }

  onDrawEnd_(event: DrawEvent) {
    event.preventDefault();
    const s = get(this.store)
    this.processFeature(
      event.feature as Feature<Polygon>,
      schemeTableau10[s.currKey! % 10],
      s.keys[s.currKey!],
    );
  }

  clear() {
    this.source.clear();
  }

  update(template: Feature[]) {
    this.clear();
    // this.points.update(template);
  }

  processFeature(feature: Feature<Polygon | Circle | Point>, color: string, name:string) {
    // Not called after modify.
    feature.setId(rand());
    feature.on(
      'propertychange',
      (e) => (e.key === 'name' || e.key === 'color') && this._updatePolygonStyle(feature)
    );
    feature.set('color', color);
    feature.set('name', name);
    sEvent.set({type: 'pointsAdded'})
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
  _updatePolygonStyle(feature: Feature<Geometry>, setStroke = true) {
    const type = feature.getGeometry()!.getType();
    let st: Style;
    if (type === 'Point') {
      // https://openlayers.org/en/latest/examples/synthetic-points.html
      st = new Style({
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color: (feature.get('color') as string) + '88' })
        })
      });
    } else {
      st = drawnStyle.clone();
      if (setStroke) {
        st.setStroke(new Stroke({ color: feature.get('color') as string, width: 3 }));
      }
      st.getText().setText(feature.get('name') as string);
    }
    feature.setStyle(st);
  }

  deletePolygon(i: number) {
    this.source.removeFeature(this.source.getFeatures()[i]);
  }

  static recurseCoords(coords: Coordinate[] | Coordinate[][]): string[] {
    if (coords[0] instanceof Array) {
      // @ts-ignore
      return coords.map((coord) => Draww.recurseCoords(coord));
    }
    // @ts-ignore
    return coords.map((c: number) => c.toExponential(4));
  }

  dump() {
    const out: ROIData[] = [];
    for (const feature of this.source.getFeatures()) {
      const g = feature.getGeometry();
      if (!g) continue;

      const coords =
        g.getType() === 'Circle'
          ? (g as Circle).getCenter()
          : (g as Polygon | Point).getCoordinates();
      const radius =
        g.getType() === 'Circle' ? (g as Circle).getRadius().toExponential(4) : undefined;

      // const coords = g
      //   .getCoordinates()
      //   .map((coord) => coord.map((c) => c.map((x) => x.toExponential(4))));

      if (g)
        out.push({
          name: feature.get('name') as string,
          type: g.getType() as Geometries,
          color: feature.get('color') as string,
          // @ts-ignore
          radius: radius,
          // @ts-ignore
          coords: Draww.recurseCoords(coords), // String here but will be converted to number once out in JSON.
          properties: (({ name, color, ...o }) => o)(g.getProperties()) // Remove name and color.
        });
    }
    // console.log(encodeURIComponent(JSON.stringify(out)));
    return out;
  }

  loadFeatures(cs: ROIData[]) {
    const keys = get(this.store).keys
    for (const { name, type, color, coords, radius, properties } of cs) {
      const geometry =
        type === 'Circle'
          ? new Circle(coords as Coordinate, radius)
          : type === 'Polygon'
          ? new Polygon(coords)
          : new Point(coords as Coordinate);
      const feature = new Feature({ geometry });
      let idx = keys.findIndex(k => k === name)
      if (idx === -1) {
        keys.push(name)
        idx = keys.length - 1
      }
      this.processFeature(feature, color ?? schemeTableau10[idx % 10], name);
      if (properties) feature.setProperties(properties);
      this.source.addFeature(feature);
    }
    if (get(this.store).currKey == undefined) get(this.store).currKey = keys.length-1
    this.store.set(get(this.store))
  }

  removeFeature(f: Feature) {
    this.source.removeFeature(f);
    sEvent.set({type: 'pointsAdded'})
  }

  removeFeaturesByName(name: string) {
    for (const f of this.source.getFeatures()) {
      if (f.get('name') === name) {
        this.source.removeFeature(f);
      }
    }
    sEvent.set({type: 'pointsAdded'})
  }


   getComposition() {
    const counts = {} as Record<string, number>;
    counts['total_'] = 0
     for (const f of this.source.getFeatures()) {
       counts['total_'] += 1
       // Prevent NaNs.
      counts[f.get('name') as string] = (counts[f.get('name') as string] ?? 0) + 1;
    }
    return counts;
  }

  updateName(old: string, newName: string) {
    for (const f of this.source.getFeatures()) {
      if (f.get('name') === old) f.set('name', newName);
    }
    sEvent.set({ type: 'pointsAdded' })
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

const initialStyle = new Style({
  fill: new Fill({ color: 'rgba(255, 255, 255, 0.3)' }),
  stroke: new Stroke({ color: '#d946ef', width: 3 }),
  text: textStyle
});

// Style for finished polygon.
const drawnStyle = new Style({
  stroke: new Stroke({ color: '#00ffe9', width: 3 }),
  text: textStyle
});

export class DrawFeature extends Draww {
  readonly points: MutableSpots;
  constructor(map: Mapp, store: typeof annoROI, mutspot: MutableSpots) {
    super(map, store);
    this.points = mutspot;
  }

  mount() {
    super.mount();
    this.points.mount();
    this.modify.on('modifyend', (e: ModifyEvent) => {
      console.debug('modifyend');
      const keyIdx = get(this.store).currKey;
      if (keyIdx == undefined) throw new Error('keyIdx is null');

      const feature = e.features.getArray()[0] as Feature<Polygon>;
      const idx = feature.getId() as number;
      feature.set('color', schemeTableau10[keyIdx % 10]);
      feature.set('keyIdx', keyIdx);
      const prev = this.featuresBeforeMod[idx];
      this.points.deleteFromPolygon(prev);
      this.points.addFromPolygon(
        feature,
        get(annoFeat).keys[keyIdx],
        get(sFeatureData).coords,
        get(annoFeat).keys
      );

      this.featuresBeforeMod[idx] = feature.clone();
    });
  }

  clear() {
    super.clear();
    this.points.clear();
  }

  processFeature(feature: Feature<Polygon>, color: string, name?: string, keyIdx: number): void {
    // Not called after modify.
    // const keyIdx = get(annotating).currKey;
    // if (points && keyIdx == undefined) throw new Error('keyIdx is null');

    feature.set('color', color);
    feature.set('name', name);
    feature.set('keyIdx', keyIdx);
    // feature.setId(rand());
    // feature.on('propertychange', (e) => {
    //   if (e.key === 'keyIdx' || e.key === 'color') {
    //     this._updatePolygonStyle(feature);
    //   }
    // });

    this.featuresBeforeMod[feature.getId() as number] = feature.clone();
    // this._updatePolygonStyle(feature);

    this.points.addFromPolygon(
      feature,
      get(annoFeat).keys[keyIdx],
      get(sFeatureData).coords,
      get(annoFeat).keys
    );
  }

  deletePolygon(i: number): void {
    const feature = this.source.getFeatures()[i];
    this.source.removeFeature(feature);
    // this.points.remove(uid);
  }

}
