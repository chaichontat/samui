import debounce from 'lodash-es/debounce';
import { Feature, type Map } from 'ol';
import type BaseEvent from 'ol/events/Event';
import { Circle, type Geometry, type Point } from 'ol/geom';
import { Draw, Modify } from 'ol/interaction';
import type { DrawEvent } from 'ol/interaction/Draw';
import type { ModifyEvent } from 'ol/interaction/Modify';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Fill, Stroke, Style } from 'ol/style';
import CircleStyle from 'ol/style/Circle';

export class _Selectt {
  readonly features: Feature[];
  readonly layer: VectorLayer<VectorSource<Geometry>>;
  readonly source: VectorSource<Geometry>;

  readonly spotDiam: number;
  template?: Feature[];

  constructor({ map, spotDiam }: { map: Map; spotDiam: number }) {
    this.features = [];
    this.source = new VectorSource({ features: this.features });
    this.layer = new VectorLayer({
      source: this.source,
      style: new Style({ stroke: new Stroke({ color: '#ffffffaa', width: 1 }) })
    });
    this.spotDiam = spotDiam;
    map.addLayer(this.layer);
  }

  update(template: Feature[]) {
    this.source.clear();
    this.template = template;
  }

  updateSelect(polygon: Geometry) {
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
          return new Feature({ geometry: new Circle(point.getCoordinates(), this.spotDiam / 2) });
        })
    );
  }
}

export class Draww {
  readonly draw: Draw;
  readonly source: VectorSource<Geometry>;
  readonly layer: VectorLayer<VectorSource<Geometry>>;
  readonly select: _Selectt;
  readonly modify: Modify;

  constructor(map: Map) {
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
        }),
        zIndex: Infinity
      }),
      stopClick: true
    });
    this.layer = new VectorLayer({
      source: this.source,
      style: new Style({
        stroke: new Stroke({ color: '#00ffe9', width: 1 })
      })
    });
    map.addLayer(this.layer);
    this.select = new _Selectt({ map, spotDiam: map.get('spotDiam') as number });
    this.modify = new Modify({ source: this.source });
    this._attachDraw();
    this._attachModify();
  }

  clear() {
    this.source.clear();
    this.select.source.clear();
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
            const polygon = e.target as Geometry;
            this.select.updateSelect(polygon);
          },
          10,
          { leading: true, trailing: false }
        )
      );
    });

    this.draw.on('drawend', (event: DrawEvent) => {
      event.preventDefault();
      const polygon = event.feature.getGeometry()!;
      this.select.updateSelect(polygon);
    });
  }

  _attachModify() {
    this.modify.on('modifyend', (e: ModifyEvent) => {
      const polygon = e.features.getArray()[0].getGeometry()!;
      if ('intersectsExtent' in polygon) {
        this.select.updateSelect(polygon);
      } else {
        console.error("Polygon doesn't have intersectsExtent");
      }
    });
  }
}
