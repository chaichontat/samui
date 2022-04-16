import type { Map } from 'ol';
import type BaseEvent from 'ol/events/Event';
import Feature from 'ol/Feature.js';
import { Circle, Geometry, Point } from 'ol/geom.js';
import { Modify, Snap } from 'ol/interaction.js';
import Draw, { DrawEvent } from 'ol/interaction/Draw.js';
import type { ModifyEvent } from 'ol/interaction/Modify.js';
import { Vector as VectorLayer } from 'ol/layer.js';
import 'ol/ol.css';
import VectorSource from 'ol/source/Vector.js';
import { Fill, Stroke, Style } from 'ol/style.js';
import CircleStyle from 'ol/style/Circle.js';
import { multipleSelect, params } from '../store';
import { debounce } from '../utils';

export function select(map: Map, features: Feature[]) {
  const drawSource = new VectorSource();

  const draw = new Draw({
    type: 'Polygon',
    source: drawSource,
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

  // Style for finished polygons.
  const drawLayer = new VectorLayer({
    source: drawSource,
    style: new Style({
      stroke: new Stroke({ color: '#00ffe9', width: 1 })
    })
  });

  const modify = new Modify({ source: drawSource });
  const snap = new Snap({ source: drawSource });

  const selectedFeatures: Feature<Geometry>[] = [];
  const selectSource = new VectorSource({ features: selectedFeatures });
  const select = new VectorLayer({
    source: selectSource,
    style: new Style({ stroke: new Stroke({ color: '#ffffff50' }) })
  });

  map.addInteraction(modify);
  map.addInteraction(snap);

  const drawClear = () => {
    selectSource.clear();
    drawSource.clear();
    multipleSelect.set([]);
  };

  draw.on('drawstart', (event: DrawEvent) => {
    event.feature.getGeometry()!.on(
      'change',
      debounce((e: BaseEvent) => {
        const polygon = e.target as Geometry;
        genCircle(selectSource, features, polygon);
      }, 10)
    );
  });

  draw.on('drawend', (event: DrawEvent) => {
    event.preventDefault();
    const polygon = event.feature.getGeometry()!;
    genCircle(selectSource, features, polygon);
  });

  modify.on('modifyend', (e: ModifyEvent) => {
    console.log(e);
    const polygon = e.features.getArray()[0].getGeometry()!;
    if ('intersectsExtent' in polygon) {
      genCircle(selectSource, features, polygon);
    } else {
      console.error("Polygon doesn't have intersectsExtent");
    }
  });

  map.addLayer(drawLayer);
  map.addLayer(select);
  return { draw, drawClear };
}

function genCircle(source: VectorSource, features: Feature[], polygon: Geometry) {
  const ids: number[] = [];
  source.clear();
  source.addFeatures(
    features
      .filter((f) => polygon.intersectsExtent(f.getGeometry()!.getExtent()))
      .map((f) => {
        ids.push(f.getId() as number);
        const point = f.getGeometry()! as Point;
        return new Feature({ geometry: new Circle(point.getCoordinates(), params.spotDiam / 2) });
      })
  );
  multipleSelect.set(ids);
}
