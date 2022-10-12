import { schemeTableau10 } from 'd3';
import type Feature from 'ol/Feature.js';
import type { Circle, Point, Polygon } from 'ol/geom.js';

import type { CoordsData } from '$lib/data/objects/coords';
import { genLRU } from '$src/lib/lru';
import { annoFeat, flashing, sEvent } from '$src/lib/store';
import { CanvasSpots } from '$src/lib/ui/overlays/points';
import { difference, intersection } from 'lodash-es';
import type { Coordinate } from 'ol/coordinate';
import type VectorSource from 'ol/source/Vector';
import { Fill, RegularShape, Stroke, Style } from 'ol/style.js';
import type { Options } from 'ol/style/Style';
import { get } from 'svelte/store';

export class MutableSpots extends CanvasSpots {
  coordsSource?: CoordsData;
  overlaySource?: VectorSource;
  points?: Feature<Point>[]; // To check if a point is already in the source.
  keyMap?: Record<string, number>;
  pointType?: 'Point' | 'Circle';
  getPointCoords?: ((f: Feature<Point>) => Coordinate) | ((f: Feature<Circle>) => Coordinate);

  // Always Point
  mount() {
    super.mount();
    this.layer!.setZIndex(Infinity);
    return this;
  }

  static getPointCoords = (f: Feature<Point>) => f.getGeometry()!.getCoordinates() as Coordinate;
  static getCircleCoords = (f: Feature<Circle>) => f.getGeometry()!.getCenter();

  startDraw(coords: CoordsData, keyMap: Record<string, number>, overlaySource: VectorSource) {
    this.clear();
    this.coordsSource = coords;
    this.overlaySource = overlaySource;
    this.points = new Array(coords.pos!.length);
    this.keyMap = keyMap;
    this.pointType = this.coordsSource.size ? 'Circle' : 'Point';
    this.getPointCoords =
      this.pointType === 'Point' ? MutableSpots.getPointCoords : MutableSpots.getCircleCoords;
  }

  updatePoint(f: Feature<Point>, label: string, remove = false) {
    // Low-level set allowed only here.
    let toSet: string | undefined;
    const labels = MutableSpots.getLabel(f, true)?.split(',') ?? [];
    const idx = labels.findIndex((x) => x === label);

    if (!remove) {
      // Add
      if (labels.length && idx === labels.length - 1) return; // Don't add the same label twice.
      if (idx > -1) {
        labels.splice(idx, 1);
      }
      labels.push(label); // A stack.
      f.set('label', labels.join(','));
      toSet = label;
    } else {
      // Remove
      if (idx > -1) {
        labels.splice(idx, 1);
      }
      f.set('label', labels.length ? labels.join(',') : undefined);
      toSet = labels.at(-1);
    }

    if (toSet) {
      if (this.keyMap![toSet] == undefined) throw new Error('Key not found');
      const color = schemeTableau10[this.keyMap![toSet] % 10].concat('cc');
      f.set('color', color);
      f.setStyle(MutableSpots.genPointStyle(color, this.coordsSource!.size ? 'outline' : 'star'));
    } else {
      f.set('color', undefined);
      f.setStyle(this.pointType === 'Point' ? undefined : transparentOutline);
    }
    return f;
  }

  static genPointStyle = genLRU((color: string, type: 'outline' | 'star') => {
    let options: Options;
    if (type === 'outline') {
      options = {
        stroke: new Stroke({ color, width: 3 }),
        fill: new Fill({ color: 'transparent' })
      };
    } else {
      options = {
        image: new RegularShape({
          fill: new Fill({ color }),
          // star
          points: 5,
          radius: 10,
          radius2: 4,
          angle: 0
        })
      };
    }
    return new Style(options);
  });

  add(
    idxs: number | number[],
    label: string,
    { polygonId = undefined as string | undefined, fireEvent = true } = {}
  ) {
    if (!Array.isArray(idxs)) {
      idxs = [idxs];
    }
    const toAdd = [];
    for (const idx of idxs) {
      let f = this.points![idx];
      if (f == undefined) {
        f = CanvasSpots._genCircle({
          ...this.coordsSource!.pos![idx],
          idx,
          mPerPx: this.coordsSource!.mPerPx,
          size: this.coordsSource.size ?? null
        });
        if (polygonId) f.set('polygonId', polygonId);
        this.points![idx] = f;
        toAdd.push(f);
      }
      this.updatePoint(f, label);
    }
    this.source.addFeatures(toAdd);
    if (fireEvent) sEvent.set({ type: 'pointsAdded' });
  }

  addFromPolygon(polygonFeat: Feature<Polygon | Circle>) {
    const label = polygonFeat.get('label') as string;
    if (!label) {
      alert('Set annotation label first.');
      return;
    }
    const polygon = polygonFeat.getGeometry()!;
    const id = polygonFeat.getId() as string;

    const filtered: number[] = [];
    this.overlaySource!.getFeaturesInExtent(polygon.getExtent()).forEach((f) => {
      if (polygon.intersectsCoordinate(f.getGeometry()!.getCoordinates())) {
        if (f.getId() == undefined) alert('f.idx undefined');
        filtered.push(f.getId() as number);
      }
    });
    this.add(filtered, label, { polygonId: id });
  }

  deleteFromPolygon(polygonFeat: Feature<Polygon | Circle>) {
    if (!this.coordsSource) throw new Error('Coords not set');
    const polygon = polygonFeat.getGeometry()!;

    this.source.getFeaturesInExtent(polygon.getExtent()).forEach((f: Feature<Point>) => {
      if (!f.getStyle()) return; // Feature not active.
      const coord = this.getPointCoords!(f);
      if (polygon.intersectsCoordinate(coord)) {
        this.updatePoint(f, polygonFeat.get('label') as string, true);
      }
    });
  }

  isinPolygons(coord: Coordinate, polygons: Feature<Polygon | Circle>[]) {
    return polygons.some((p) => p.getGeometry()!.intersectsCoordinate(coord));
  }

  modifyFromPolygon(
    oldPol: Feature<Polygon | Circle>,
    // Necessary when two polygons of the same label are overlapping.
    // Need to check if the point is in the other polygon.
    polygons: Feature<Polygon | Circle>[]
  ) {
    const oldPolygon = oldPol.getGeometry()!;
    // const newPolygon = newPol.getGeometry()!;
    // Label at Feature NOT Polygon.
    // Polygon never changes label.
    const label = oldPol.get('label') as string;

    // Polygon add handled by processFeature.
    this.source.getFeaturesInExtent(oldPolygon.getExtent()).forEach((f: Feature<Point>) => {
      if (!f.getStyle()) return; // Feature not active.
      const coord = this.getPointCoords!(f as Feature<Circle>);
      if (oldPolygon.intersectsCoordinate(coord)) {
        if (this.isinPolygons(coord, polygons)) {
          this.updatePoint(f, label);
        } else {
          this.updatePoint(f, label, true);
        }
      }
    });
  }

  get length() {
    let count = 0;
    this.source.getFeatures().forEach((f) => {
      if (MutableSpots.getLabel(f)) count++;
    });
    return count;
  }

  getAllPointsByLabel() {
    const points = { unlabeled: [] } as Record<string, number[]>;
    for (let i = 0; i < this.points!.length; i++) {
      const f = this.points![i];
      const label = f ? MutableSpots.getLabel(f) : undefined; // Can be undefined for deleted points.
      if (!label) {
        points.unlabeled.push(i);
        continue;
      }
      if (points[label] == undefined) points[label] = [];
      points[label].push(i);
    }
    return points;
  }

  getComposition() {
    let sum = 0;
    const counts = {} as Record<string, number>;
    Object.entries(this.getAllPointsByLabel()).forEach(([label, ps]) => {
      if (label == 'unlabeled') return;
      counts[label] = ps.length;
      sum += ps.length;
    });
    counts.total_ = sum;
    return counts;
  }

  clear() {
    this.source.clear();
    this.points = undefined;
    this.coordsSource = undefined;
    this.keyMap = undefined;
  }

  remove(idx: number) {
    const f = this.source.getFeatureById(idx);

    if (f) {
      this.source.removeFeature(f);
    }
  }

  relabel(old: string, newlabel: string) {
    this.source.forEachFeature((f) => {
      if (MutableSpots.getLabel(f) === old) {
        this.updatePoint(f, newlabel);
      }
    });
  }

  static getLabel(f: Feature<Point>, returnAll = false) {
    const labels = f.get('label') as string | undefined;
    if (returnAll) return labels;
    return labels?.split(',').at(-1);
  }

  static getId(f: Feature<Point>) {
    return f.getId() as number | string;
  }

  removeByLabel(label: string) {
    this.source.forEachFeature((f) => {
      if (MutableSpots.getLabel(f) === label) {
        this.updatePoint(f, label, true);
      }
    });
  }

  dump() {
    const points = this.source
      .getFeatures()
      .map((f) => [MutableSpots.getId(f), MutableSpots.getLabel(f)].join(','));
    return 'id,label\n' + points.join('\n');
  }

  load(cs: { id: number; label?: string }[], coords: CoordsData, overlaySource: VectorSource) {
    const pos = coords.pos;

    // if (!pos) {
    //   alert('Load existing coordinates first.');
    //   return;
    // }

    const ins = intersection(
      cs.map((c) => c.id),
      pos!.map((p) => p.id)
    );

    if (ins.length !== cs.length) {
      alert(
        'Some points are not in the current coordinates. \
Most likely cause: mismatched samples. \
The imported points must be a subset of current points. \
That is, the current points must contain the ID of all imported points.'
      );
      return;
    }

    const unique = new Set(cs.map((c) => c.label ?? 'Unlabeled'));
    const anno = get(annoFeat);

    // Force update store.
    const newKeys = anno.keys.concat(difference(Array.from(unique), anno.keys));
    anno.keys = newKeys;
    anno.currKey = newKeys.length - 1;
    annoFeat.set(anno);

    this.startDraw(coords, get(annoFeat).reverseKeys, overlaySource);

    for (const { id, label } of cs) {
      const match = pos!.find((p) => p.id === id)!;
      this.add(match.idx!, label ?? 'Unlabeled');
    }

    sEvent.set({ type: 'pointsAdded' });
    flashing.set('Feature Annotation');
  }
}

const dontCheck = [
  'constructor',
  'updateFeature',
  'load',
  'clear',
  'length',
  'startDraw',
  'length',
  'mount'
];

Object.getOwnPropertyNames(MutableSpots.prototype).forEach((name) => {
  if (dontCheck.includes(name)) return;
  MutableSpots.prototype['_' + name] = MutableSpots.prototype[name];
  MutableSpots.prototype[name] = function () {
    if (!this.coordsSource) throw new Error(`Coords not set at ${name}`);
    return this['_' + name](...arguments);
  };
});

const transparentOutline = new Style({
  stroke: new Stroke({ color: 'transparent', width: 0 }),
  fill: new Fill({ color: 'transparent' })
});
