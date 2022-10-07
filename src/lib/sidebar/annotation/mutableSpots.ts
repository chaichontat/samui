import { schemeTableau10 } from 'd3';
import type Feature from 'ol/Feature.js';
import type { Circle, Geometry as Point, Point, Polygon } from 'ol/geom.js';

import type { CoordsData } from '$lib/data/objects/coords';
import { genLRU } from '$src/lib/lru';
import { annoFeat, flashing, sEvent, sFeatureData } from '$src/lib/store';
import { CanvasSpots } from '$src/lib/ui/overlays/points';
import { difference, intersection } from 'lodash-es';
import type { Coordinate } from 'ol/coordinate';
import { Fill, RegularShape, Style } from 'ol/style.js';
import { get } from 'svelte/store';

export class MutableSpots extends CanvasSpots {
  coordsSource?: CoordsData;
  points?: Feature<Point>[]; // To check if a point is already in the source.
  keyMap?: Record<string, number>;

  // Always Point
  mount() {
    super.mount();
    this.layer!.setZIndex(Infinity);
    return this;
  }

  startDraw(coords: CoordsData, keyMap: Record<string, number>) {
    this.clear();
    this.coordsSource = coords;
    this.points = new Array(coords.pos!.length);
    this.keyMap = keyMap;
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
      const color = schemeTableau10[this.keyMap![toSet] % 10].concat('aa');
      f.set('color', color);
      f.setStyle(MutableSpots.genPointStyle(color));
    } else {
      f.set('color', undefined);
      f.setStyle(undefined);
    }
    return f;
  }

  static genPointStyle = genLRU(
    (color: string) =>
      new Style({
        image: new RegularShape({
          fill: new Fill({ color }),
          // star
          points: 5,
          radius: 10,
          radius2: 4,
          angle: 0
        })
      })
  );

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
          size: null
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
    this.coordsSource!.pos!.forEach((f) => {
      if (
        polygon.intersectsCoordinate([
          f.x * this.coordsSource!.mPerPx,
          -f.y * this.coordsSource!.mPerPx
        ])
      ) {
        if (f.idx == undefined) alert('f.idx undefined');
        filtered.push(f.idx!);
      }
    });
    this.add(filtered, label, { polygonId: id });
  }

  deleteFromPolygon(polygonFeat: Feature<Polygon | Circle>) {
    if (!this.coordsSource) throw new Error('Coords not set');
    const polygon = polygonFeat.getGeometry()!;

    this.source.getFeatures().forEach((f: Feature<Point>) => {
      const coord = f.getGeometry()!.getCoordinates() as Coordinate;
      if (polygon.intersectsCoordinate(coord)) {
        this.updatePoint(f, polygonFeat.get('label') as string, true);
      }
    });
  }

  static isinPolygons(f: Feature<Point>, polygons: Feature<Polygon | Circle>[]) {
    const coord = f.getGeometry()!.getCoordinates() as Coordinate;
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
    this.source.getFeatures().forEach((f: Feature<Point>) => {
      const coord = f.getGeometry()!.getCoordinates() as Coordinate;
      if (oldPolygon.intersectsCoordinate(coord)) {
        if (MutableSpots.isinPolygons(f, polygons)) {
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

  getComposition() {
    const counts = {} as Record<string, number>;
    counts.total_ = 0;
    for (const f of this.source.getFeatures()) {
      const label = MutableSpots.getLabel(f); // Can be undefined for deleted points.
      if (!label) continue;
      counts.total_ += 1;
      counts[label] = (counts[label] ?? 0) + 1;
    }
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

  load(cs: { id: number; label?: string }[], coords: CoordsData) {
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
      alert('Some points are not in the current coordinates.');
      return;
    }

    const unique = new Set(cs.map((c) => c.label ?? 'Unlabeled'));
    const anno = get(annoFeat);

    // Force update store.
    const newKeys = anno.keys.concat(difference(Array.from(unique), anno.keys));
    anno.keys = newKeys;
    anno.currKey = newKeys.length - 1;
    annoFeat.set(anno);

    this.startDraw(coords, get(annoFeat).reverseKeys);

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
