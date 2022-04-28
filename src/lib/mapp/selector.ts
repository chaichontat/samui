import debounce from 'lodash-es/debounce';
import { Feature, type Map } from 'ol';
import type { Coordinate } from 'ol/coordinate';
import type BaseEvent from 'ol/events/Event';
import { Circle, Point, Polygon } from 'ol/geom';
import { Draw, Modify } from 'ol/interaction';
import type { DrawEvent } from 'ol/interaction/Draw';
import type { ModifyEvent } from 'ol/interaction/Modify';
import VectorLayer from 'ol/layer/Vector';
import VectorSource, { VectorSourceEvent } from 'ol/source/Vector';
import { Fill, Stroke, Style, Text } from 'ol/style';
import CircleStyle from 'ol/style/Circle';
import type { SpotParams } from '../data/image';

export class _Selectt {
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

  updateSelect(polygon: Point) {
    if (!this.template) {
      console.warn('No template defined for select.');
      return;
    }
    const ids: number[] = [];
    this.source.clear();
    this.source.addFeatures(
      this.template
        .filter((f) => polygon.intersectsExtent(f.getGeometry()!.getExtent()))
        .map((f) => {
          ids.push(f.getId() as number);
          const point = f.getGeometry()! as Point;
          return new Feature({ geometry: new Point(point.getCoordinates()), size: 10 });
        })
    );
  }
}

export class Draww {
  readonly draw: Draw;
  readonly source: VectorSource<Polygon>;
  readonly layer: VectorLayer<typeof this.source>;
  readonly select: _Selectt;
  readonly modify: Modify;

  constructor() {
    this.source = new VectorSource();
    this.draw = new Draw({
      type: 'Polygon',
      source: this.source,
      // condition: platformModifierKeyOnly,
      // freehandCondition: shiftKeyOnly,
      // Style for drawing polygons.
      style: new Style({
        fill: new Fill({ color: 'rgba(255, 255, 255, 0.2)' }),
        stroke: new Stroke({ color: '#00ffe9', width: 2 }),
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({
            color: [0, 153, 255, 1]
          }),
          stroke: new Stroke({
            color: '#fff',
            width: 1.5
          })
        })
      }),
      stopClick: true
    });

    const selectedStyle = new Style({
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

    this.layer = new VectorLayer({
      source: this.source,
      style: (feature) => {
        selectedStyle.getText().setText(feature.get('name') as string);
        return selectedStyle;
      }
    });

    this.select = new _Selectt();
    this.modify = new Modify({ source: this.source });
    this._attachDraw();
    this._attachModify();
  }

  mount(map: Map) {
    this.layer.setZIndex(50);
    map.addLayer(this.layer);
    this.select.mount(map);
  }

  clear() {
    this.source.clear();
  }

  update(template: Feature[]) {
    this.source.clear();
    this.select.update(template);
  }

  _attachDraw() {
    this.draw.on('drawstart', (event: DrawEvent) => {
      event.feature.getGeometry()!.on(
        'change',
        debounce(
          (e: BaseEvent) => {
            const polygon = e.target as Point;
            this.select.updateSelect(polygon);
          },
          10,
          { leading: true, trailing: false }
        )
      );
    });

    this.draw.on('drawend', (event: DrawEvent) => {
      event.preventDefault();
      const polygon = event.feature.getGeometry()! as Point;
      this.select.updateSelect(polygon);
    });
  }

  _attachModify() {
    this.modify.on('modifyend', (e: ModifyEvent) => {
      const polygon = e.features.getArray()[0].getGeometry()!;
      if ('intersectsExtent' in polygon) {
        this.select.updateSelect(polygon as Point);
      } else {
        console.error("Polygon doesn't have intersectsExtent");
      }
    });
  }

  getPolygonsName() {
    return this.source.getFeatures().map((f) => (f.get('name') ?? '') as string);
  }

  setPolygonName(i: number, name: string) {
    const feat = this.source.getFeatures().at(i);
    if (!feat) throw new Error('No feature at index ' + i.toString());
    feat.set('name', name);
  }

  deletePolygon(i: number) {
    this.source.removeFeature(this.source.getFeatures()[i]);
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
