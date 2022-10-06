import { annoFeat, flashing, sEvent, type annoROI } from '$src/lib/store';
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
import { rand } from '../../utils';

export type Geometries = 'Polygon' | 'Circle' | 'Point';
export type ROIInstance = {
  label: string;
  type: Geometries;
  coords: Coordinate[][] | Coordinate;
  radius?: number;
  properties?: Record<string, any>;
};

export type ROIData = {
  sample: string;
  time: string;
  mPerPx: number;
  rois: ROIInstance[];
};

export class Draww {
  draw: Draw;
  snap: Snap;
  store: typeof annoROI | typeof annoFeat;
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
    this.store = store;
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
    this.modify.on('modifyend', (e: ModifyEvent) => this.onDrawEnd_(e));
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

  onDrawEnd_(event: DrawEvent | ModifyEvent) {
    event.preventDefault();
    const s = get(this.store);

    let feature: Feature<Geometry>;
    if (event.type === 'drawend') {
      feature = (event as DrawEvent).feature;
    } else {
      feature = (event as ModifyEvent).features.item(0) as Feature<Polygon>;
    }
    console.log(feature.getGeometry().getCoordinates());

    this.processFeature(
      feature,
      schemeTableau10[s.currKey! % 10],
      s.keys[s.currKey!],
      event.type === 'drawend'
    );
  }

  clear() {
    this.source.clear();
  }

  update(template: Feature[]) {
    this.clear();
    // this.points.update(template);
  }

  processFeature(
    feature: Feature<Polygon | Circle | Point>,
    color: string,
    label: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    newDraw = true
  ) {
    if (feature.getId() == undefined) {
      feature.setId(rand());
      feature.on(
        'propertychange',
        (e) => (e.key === 'label' || e.key === 'color') && this._updatePolygonStyle(feature)
      );
    }

    feature.set('color', color);
    feature.set('label', label);
    sEvent.set({ type: 'pointsAdded' });
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

  // Need to rerun on label change.
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
      st.getText().setText(feature.get('label') as string);
    }
    feature.setStyle(st);
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
          label: feature.get('label') as string,
          type: g.getType() as Geometries,
          // @ts-ignore
          radius: radius,
          // @ts-ignore
          coords: Draww.recurseCoords(coords), // String here but will be converted to number once out in JSON.
          properties: (({ label, color, ...o }) => o)(g.getProperties()) // Remove label and color.
        });
    }
    // console.log(encodeURIComponent(JSON.stringify(out)));
    return out;
  }

  loadFeatures(cs: ROIInstance[]) {
    const keys = get(this.store).keys;
    for (const { label, type, coords, radius, properties } of cs) {
      const geometry =
        type === 'Circle'
          ? new Circle(coords as Coordinate, radius)
          : type === 'Polygon'
          ? new Polygon(coords)
          : new Point(coords as Coordinate);
      const feature = new Feature({ geometry });
      let idx = keys.findIndex((k) => k === label);
      if (idx === -1) {
        keys.push(label);
        idx = keys.length - 1;
      }
      this.processFeature(feature, schemeTableau10[idx % 10], label);
      if (properties) feature.setProperties(properties);
      this.source.addFeature(feature);
    }
    if (get(this.store).currKey == undefined) get(this.store).currKey = keys.length - 1;
    this.store.set(get(this.store));
    flashing.set('ROI Annotation');
  }

  removeFeature(f: Feature) {
    this.source.removeFeature(f);
    sEvent.set({ type: 'pointsAdded' });
  }

  removeFeaturesByLabel(label: string) {
    for (const f of this.source.getFeatures()) {
      if (f.get('label') === label) {
        this.source.removeFeature(f);
      }
    }
    sEvent.set({ type: 'pointsAdded' });
  }

  getComposition() {
    const counts = {} as Record<string, number>;
    counts['total_'] = 0;
    for (const f of this.source.getFeatures()) {
      counts['total_'] += 1;
      // Prevent NaNs.
      counts[f.get('label') as string] = (counts[f.get('label') as string] ?? 0) + 1;
    }
    return counts;
  }

  relabel(old: string, newlabel: string) {
    for (const f of this.source.getFeatures()) {
      if (f.get('label') === old) f.set('label', newlabel);
    }
    sEvent.set({ type: 'pointsAdded' });
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
