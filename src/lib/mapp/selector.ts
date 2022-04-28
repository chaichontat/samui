import debounce from 'lodash-es/debounce';
import { Feature, type Map } from 'ol';
import type { Coordinate } from 'ol/coordinate';
import type BaseEvent from 'ol/events/Event';
import { Circle, Point, Polygon } from 'ol/geom';
import { Draw, Modify } from 'ol/interaction';
import type { DrawEvent } from 'ol/interaction/Draw';
import type { ModifyEvent } from 'ol/interaction/Modify';
import Select from 'ol/interaction/Select.js';
import VectorLayer from 'ol/layer/Vector';
import VectorSource, { VectorSourceEvent } from 'ol/source/Vector';
import { Fill, Stroke, Style, Text } from 'ol/style';
import CircleStyle from 'ol/style/Circle';
import { tableau10arr } from '../colors';
import type { SpotParams } from '../data/image';

export class _Points {
  readonly features: Feature[];
  readonly source: VectorSource<Point>;
  readonly layer: VectorLayer<typeof this.source>;
  template?: Feature[];

  constructor() {
    this.features = [];
    this.source = new VectorSource({ features: this.features });
    this.layer = new VectorLayer({
      source: this.source
      // style: new Style({
      //   fill: new Fill({ color: 'rgba(255, 255, 255, 0.2)' })
      // })
    });
  }

  mount(map: Map) {
    map.addLayer(this.layer);
  }

  update(template: Feature[]) {
    this.source.clear();
    this.template = template;
  }

  updateSelect(feature: Feature<Polygon>) {
    if (!this.template) {
      throw new Error('No template defined for select.');
    }
    const ids: number[] = [];
    const polygon = feature.getGeometry()!;
    // this.source.clear();

    this.source.addFeatures(
      this.template
        .filter((f) => polygon.intersectsExtent(f.getGeometry()!.getExtent()))
        .map((f) => {
          ids.push(f.getId() as number);
          const point = f.getGeometry()! as Point;
          const feat = new Feature({
            geometry: point.clone(),
            style: new Style({
              stroke: new Stroke({
                color: feature.get('color') as `#${string}`,
                width: 1
              }),
              fill: new Fill({ color: '#00000000' })
            }),
            size: 10
          });
          feat.set('origin', feature.getId());

          return feat;
        })
    );
    return ids;
  }

  remove(uid: number) {
    this.source.getFeatures().forEach((f) => {
      if (f.get('origin') === uid) {
        this.source.removeFeature(f);
      }
    });
  }
}

export class Draww {
  readonly draw: Draw;
  readonly source: VectorSource<Polygon>;
  readonly selectionLayer: VectorLayer<typeof this.source>;
  readonly points: _Points;
  readonly modify: Modify;

  _currHighlight: number | null = null;

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

  constructor() {
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

    this.selectionLayer = new VectorLayer({
      source: this.source
    });

    this.points = new _Points();
    this.modify = new Modify({ source: this.source });

    this._attachDraw();
    this._attachModify();
  }

  mount(map: Map) {
    this.selectionLayer.setZIndex(50);
    map.addLayer(this.selectionLayer);
    this.points.mount(map);
  }

  clear() {
    this.source.clear();
  }

  update(template: Feature[]) {
    this.source.clear();
    this.points.update(template);
  }

  _attachDraw() {
    // this.draw.on('drawstart', (event: DrawEvent) => {
    //   event.feature.getGeometry()!.on(
    //     'change',
    //     debounce((e: BaseEvent) => this.select.updateSelect(e.target as Point), 10, {
    //       leading: true,
    //       trailing: false
    //     })
    //   );
    // });

    this.draw.on('drawend', (event: DrawEvent) => {
      event.preventDefault();
      const feature = event.feature as Feature<Polygon>;
      const cid = this.source.getFeatures().length % tableau10arr.length;
      feature.set('color', tableau10arr[cid]);
      feature.setId(Math.random());

      this._updatePolygonStyle(feature);
      this.points.updateSelect(feature);
    });
  }

  _attachModify() {
    this.modify.on('modifyend', (e: ModifyEvent) => {
      const polygon = e.features.getArray()[0].getGeometry()!;
      if ('intersectsExtent' in polygon) {
        this.points.updateSelect(e.features.getArray()[0] as Feature<Polygon>);
      } else {
        console.error("Polygon doesn't have intersectsExtent");
      }
    });
  }

  highlightPolygon(i: number | null) {
    if (i === undefined) throw new Error('i is undefined');
    this.unhighlightPolygon();
    if (i === null) return;
    const feat = this.source.getFeatures().at(i);
    if (!feat) throw new Error('No feature at index ' + i.toString());
    this._currHighlight = i;
    this._updatePolygonStyle(feat, false);
  }

  unhighlightPolygon() {
    if (this._currHighlight === null) return;
    const feat = this.source.getFeatures().at(this._currHighlight);
    if (!feat) throw new Error('No feature at index ' + this._currHighlight.toString());
    this._updatePolygonStyle(feat);
  }

  // Need to rerun on name change.
  _updatePolygonStyle(feature: Feature<Polygon>, setStroke = true) {
    const st = this.style.clone();
    if (setStroke) {
      st.setStroke(new Stroke({ color: feature.get('color') as `#{string}`, width: 2 }));
    }
    st.getText().setText(feature.get('name') as string);
    feature.setStyle(st);
  }

  getPolygonsName() {
    return this.source.getFeatures().map((f) => (f.get('name') ?? '') as string);
  }

  setPolygonName(i: number, name: string) {
    const feat = this.source.getFeatures().at(i);
    if (!feat) throw new Error('No feature at index ' + i.toString());
    feat.set('name', name);
    this._updatePolygonStyle(feat);
  }

  deletePolygon(i: number) {
    const feature = this.source.getFeatures()[i];
    const uid = feature.getId() as number;
    this.source.removeFeature(feature);
    this.points.remove(uid);
  }

  dumpPolygons() {
    const out: Coordinate[][][] = [];
    for (const feature of this.source.getFeatures()) {
      const g = feature.getGeometry();
      if (g) out.push(g.getCoordinates());
    }
    return out;
  }

  loadPolygons(cs: Coordinate[][][]) {
    this.source.clear();
    for (const c of cs) {
      this.source.addFeature(new Feature({ geometry: new Polygon(c) }));
    }
  }
}
