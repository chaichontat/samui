import { annoFeat, flashing, sEvent, sSample, type annoROI } from '$src/lib/store';
import { schemeTableau10 } from 'd3';
import { Feature } from 'ol';
import type { Coordinate } from 'ol/coordinate.js';
import { click } from 'ol/events/condition';
import { Circle, Geometry, MultiPoint, Point, Polygon } from 'ol/geom.js';
import { Draw, Modify, Select, Snap, Translate } from 'ol/interaction.js';
import type { DrawEvent } from 'ol/interaction/Draw';
import type { ModifyEvent } from 'ol/interaction/Modify';
import type { SelectEvent } from 'ol/interaction/Select';
import type { TranslateEvent } from 'ol/interaction/Translate';
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
  type: 'Feature';
  geometry: { type: 'Polygon' | 'Point' | 'LineString'; coordinates: Coordinate[][] | Coordinate };
  properties?: Record<string, any>;
};

export interface ROIData {
  sample: string;
  time: string;
  mPerPx: number;
  type: 'FeatureCollection';
  features: ROIInstance[];
}

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
  selectHandler?: (e: KeyboardEvent) => void;
  readonly map: Mapp;

  _currHighlight: number | null = null;
  _colorCounter = 0; // Ensures that color increases when deleting older selections.

  constructor(map: Mapp, store: typeof annoROI) {
    this.source = new VectorSource();
    this.map = map;
    this.store = store;
    this.selectionLayer = new VectorLayer({ source: this.source });
    this.draw = new Draw({ type: 'Polygon', source: this.source });
    this.select = new Select({
      layers: [this.selectionLayer],
      style: initialStyle,
      condition: click
    });
    this.modify = new Modify({ source: this.source });
    this.translate = new Translate({ features: this.select.getFeatures() });
    this.snap = new Snap({ source: this.source });
  }

  selectHandler_ = (ev: SelectEvent, e: KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        this.select.getFeatures().clear();
        this.map.map!.removeInteraction(this.translate);
        this.addedTranslate = false;
        break;
      case 'Delete':
        for (const s of ev.selected) {
          this.removeFeature(s);
        }
        this.select.getFeatures().clear();
        this.map.map!.removeInteraction(this.translate);
        this.addedTranslate = false;
        break;
      case 'Backspace':
        for (const s of ev.selected) {
          this.removeFeature(s);
        }
        this.select.getFeatures().clear();
        this.map.map!.removeInteraction(this.translate);
        this.addedTranslate = false;
        break;
    }
  };
  addedTranslate = false;

  mount() {
    this.changeDrawType('Polygon', true);
    this.map.map!.addInteraction(this.modify);
    this.modify.on('modifyend', (e: ModifyEvent) => this.onDrawEnd_(e));
    // this.translate.on('translateend', (e: TranslateEvent) => this.onDrawEnd_(e));
    this.map.map!.addLayer(this.selectionLayer);
    this.selectionLayer.setZIndex(Infinity);

    this.map.map!.addInteraction(this.select);

    // Deselect as well.
    this.select.on('select', (ev: SelectEvent) => {
      if (ev.selected.length) {
        if (!this.addedTranslate) {
          this.map.map!.addInteraction(this.translate);
          this.addedTranslate = true;
        }
        if (this.selectHandler) {
          document.removeEventListener('keydown', this.selectHandler);
        }
        this.selectHandler = (e: KeyboardEvent) => this.selectHandler_(ev, e);
        document.addEventListener('keydown', this.selectHandler);
        return;
      }

      if (this.selectHandler) {
        document.removeEventListener('keydown', this.selectHandler);
        this.selectHandler = undefined;
      }
      this.map.map!.removeInteraction(this.translate);
      this.addedTranslate = false;
    });
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

  onDrawEnd_(event: DrawEvent | ModifyEvent | TranslateEvent | Feature) {
    let feature: Feature<Geometry>;
    if (event instanceof Feature) {
      feature = event;
    } else if (event.type === 'drawend') {
      feature = (event as DrawEvent).feature;
      event.preventDefault();
    } else {
      feature = (event as ModifyEvent).features.item(0) as Feature<Polygon>;
      event.preventDefault();
    }

    const s = get(this.store);
    this.processFeature(
      feature,
      schemeTableau10[s.currKey! % 10],
      s.keys[s.currKey!],
      s.currKey!,
      event.type === 'drawend' // Ignore error as feature.type is undefined anyway.
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
    keyIdx: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    newDraw = true
  ) {
    if (feature.getId() != undefined) return;

    feature.setId(rand());
    feature.on(
      'propertychange',
      (e) => (e.key === 'label' || e.key === 'color') && this._updatePolygonStyle(feature)
    );
    feature.set('color', color);
    feature.set('label', label);
    feature.set('keyIdx', keyIdx);
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
    const color = feature.get('color') as string;
    let st: Style;
    if (type === 'Point') {
      // https://openlayers.org/en/latest/examples/synthetic-points.html
      st = new Style({
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color: color.concat('88') })
        })
      });
      feature.setStyle(st);
      return;
    }

    st = drawnStyle.clone();
    if (setStroke) {
      st.setStroke(new Stroke({ color, width: 3 }));
    }
    st.getText().setText(this.getLabel(feature));

    if (type === 'Circle') {
      feature.setStyle(st);
      return;
    }

    // Polygon
    const vt = new Style({
      image: new CircleStyle({
        radius: 5,
        fill: new Fill({ color })
      }),
      geometry: (feature) => {
        // return the coordinates of the first ring of the polygon
        const coordinates = feature.getGeometry()!.getCoordinates()[0];
        return new MultiPoint(coordinates);
      }
    });
    feature.setStyle([st, vt]);
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
    const out: ROIData['features'] = [];
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
          type: 'Feature',
          geometry: {
            type: g.getType() == 'Circle' ? 'Point' : g.getType(),
            // @ts-ignore
            coordinates: Draww.recurseCoords(coords) // String here but will be converted to number once out in JSON.
          },
          properties: {
            ...(({ label, color, ...o }) => o)(g.getProperties()), // Remove label and color.
            ...(radius && { radius })
          },
          label: feature.get('label') as string
        });
    }
    // console.log(encodeURIComponent(JSON.stringify(out)));
    return { type: 'FeatureCollection', features: out };
  }

  loadFeatures({ features: cs, sample, mPerPx }: ROIData) {
    if (!cs.length) {
      alert('No ROIs found in this file.');
      return;
    }

    if (get(sSample).name !== sample) {
      alert(`Sample does not match. Got ${sample} but currently viewing ${get(sSample).name}.`);
      return;
    }

    if (get(sSample).mPerPx !== mPerPx) {
      alert(
        `Scale does not match. \
Got ${mPerPx} m/px but current sample has ${get(sSample).mPerPx} m/px.`
      );
      return;
    }

    const store = get(this.store);
    for (const { label, geometry, properties } of cs) {
      const { type, coordinates } = geometry;
      const geo =
        type === 'Point' && properties?.radius
          ? new Circle(coordinates as Coordinate)
          : type === 'Polygon'
          ? new Polygon(coordinates)
          : new Point(coordinates as Coordinate);
      const feature = new Feature({ geometry: geo });
      let idx = store.keys.findIndex((k) => k === label);
      if (idx === -1) {
        store.keys.push(label);
        this.store.set(store); // Necessary to trigger set to update reverseKeys.
        idx = store.keys.length - 1;
      }
      this.processFeature(feature, schemeTableau10[idx % 10], label, idx, true);
      if (properties) feature.setProperties(properties);
      this.source.addFeature(feature);
    }
    if (store.currKey == undefined) store.currKey = store.keys.length - 1;
    this.store.set(store);
    // flashing.set('ROI Annotation');
  }

  getLabel(f: Feature<Geometry>) {
    return f.get('label') as string;
  }

  removeFeature(f: Feature) {
    this.source.removeFeature(f);
    sEvent.set({ type: 'pointsAdded' });
  }

  removeFeaturesByLabel(label: string) {
    for (const f of this.source.getFeatures()) {
      if (this.getLabel(f) === label) {
        this.source.removeFeature(f);
      }
    }
    sEvent.set({ type: 'pointsAdded' });
  }

  getCounts() {
    const counts = {} as Record<string, number>;
    counts['total_'] = 0;
    for (const f of this.source.getFeatures()) {
      counts['total_'] += 1;
      // Prevent NaNs.
      counts[this.getLabel(f)] = (counts[this.getLabel(f)] ?? 0) + 1;
    }
    return counts;
  }

  relabel(old: string, newlabel: string) {
    for (const f of this.source.getFeatures()) {
      if (this.getLabel(f) === old) f.set('label', newlabel);
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
  fill: new Fill({ color: 'transparent' }), // so that getFeatureAtPixel can see this.
  text: textStyle
});
