import * as d3 from 'd3';
import type Feature from 'ol/Feature.js';
import type { Circle, Geometry, Point, Polygon } from 'ol/geom.js';

import type { CoordsData } from '$lib/data/objects/coords';
import { annoFeat, flashing, sEvent, sFeatureData } from '$src/lib/store';
import { CanvasSpots } from '$src/lib/ui/overlays/points';
import { difference, intersection } from 'lodash-es';
import { Fill, RegularShape, Style } from 'ol/style.js';
import { get } from 'svelte/store';

export class MutableSpots extends CanvasSpots {
  coordsSource?: CoordsData;
  // points?: Feature<Point>[]; // To check if a point is already in the source.
  // Always Point
  mount() {
    super.mount();
    this.layer!.setZIndex(Infinity);
    return this;
  }

  startDraw(coords: CoordsData) {
    this.coordsSource = coords;
    // this.points = new Array(coords.pos!.length);
  }

  updateFeature(f: Feature<Geometry>, label: string, ant: string[]) {
    f.set('label', label);
    f.setStyle(
      new Style({
        image: new RegularShape({
          fill: new Fill({
            color: d3.schemeTableau10[ant.findIndex((x) => x === label) % 10] + 'aa'
          }),
          points: 5,
          radius: 10,
          radius2: 4,
          angle: 0
        })
      })
    );
    return f;
  }

  add(idx: number, label: string, ov: CoordsData, ant: string[], fromMultiple = false) {
    if (ov.mPerPx == undefined) throw new Error('mPerPx undefined.');
    let f = this.get(idx);
    if (f == undefined) {
      // Null to generate Point, instead of Circle.
      f = CanvasSpots._genCircle({ ...ov.pos![idx], idx, mPerPx: ov.mPerPx, size: null });
      this.source.addFeature(f);
    }
    this.updateFeature(f, label, ant);
    if (!fromMultiple) sEvent.set({ type: 'pointsAdded' });
  }

  addMultiple(
    idxs: number[],
    label: string,
    ov: CoordsData,
    ant: string[],
    id: string | undefined = undefined
  ) {
    const toAdd = [];
    for (const idx of idxs) {
      let f = this.get(idx);
      if (f == undefined) {
        f = CanvasSpots._genCircle({
          ...ov.pos![idx],
          idx,
          mPerPx: ov.mPerPx,
          size: null
        });
        if (id) f.set('polygon', id);
        toAdd.push(f);
      }
      this.updateFeature(f, label, ant);
    }
    this.source.addFeatures(toAdd);
    sEvent.set({ type: 'pointsAdded' });
  }

  get length() {
    return this.source.getFeatures().length;
  }

  getComposition() {
    const counts = {} as Record<string, number>;
    counts.total_ = 0;
    for (const f of this.source.getFeatures()) {
      counts.total_ += 1;
      counts[f.get('label')] = (counts[f.get('label')] ?? 0) + 1;
    }
    return counts;
  }

  clear() {
    this.source.clear();
  }

  addFromPolygon(
    polygonFeat: Feature<Polygon | Circle>,
    label: string,
    ov: CoordsData,
    ant: string[]
  ) {
    if (!label) {
      alert('Set annotation label first.');
      return;
    }
    const polygon = polygonFeat.getGeometry()!;
    const id = polygonFeat.getId();
    // const template = [];
    // for (let i = 0; i < ov.pos!.length; i++) {
    //   const newCircle = CanvasSpots._genCircle({ ...ov.pos![i], mPerPx: ov.mPerPx!, size: null });
    //   newCircle.set('polygon', id);
    //   template.push(newCircle);
    // }

    const filtered: number[] = [];
    ov.pos!.forEach((f) => {
      if (polygon.intersectsCoordinate([f.x * ov.mPerPx, -f.y * ov.mPerPx])) {
        if (f.idx == undefined) alert('f.idx undefined');
        filtered.push(f.idx!);
      }
    });

    this.addMultiple(filtered, label, ov, ant, id);
  }

  deleteFromPolygon(polygonFeat: Feature<Polygon | Circle>) {
    const polygon = polygonFeat.getGeometry()!;

    this.source.getFeatures().forEach((f: Feature<Point>) => {
      const coord = f.getGeometry()!.getCoordinates();
      if (polygon.intersectsCoordinate(coord)) {
        console.log(coord);
        this.source.removeFeature(f);
      }
    });
  }

  remove(idx: number) {
    const f = this.source.getFeatureById(idx);
    if (f) {
      this.source.removeFeature(f);
    }
  }

  relabel(old: string, newlabel: string) {
    this.source.forEachFeature((f) => {
      if (f.get('label') === old) {
        f.set('label', newlabel);
      }
    });
  }

  removeByLabel(label: string) {
    this.source.forEachFeature((f) => {
      if (f.get('label') === label) {
        this.source.removeFeature(f);
      }
    });
  }

  dump() {
    const points = this.source.getFeatures().map((f) => [f.get('id'), f.get('label')].join(','));
    return 'id,label\n' + points.join('\n');
  }

  loadFeatures(cs: { id: number; label?: string }[]) {
    const coords = get(sFeatureData).coords;
    const pos = coords.pos;

    if (!pos) {
      alert('Load existing coordinates first.');
      return;
    }

    const ins = intersection(
      cs.map((c) => c.id),
      pos.map((p) => p.id)
    );

    if (ins.length !== cs.length) {
      alert('Some points are not in the current coordinates.');
      return;
    }

    const unique = new Set(cs.map((c) => c.label ?? 'Unlabeled'));
    const keys = get(annoFeat).keys;

    const newKeys = keys.concat(difference(Array.from(unique), keys));
    get(annoFeat).keys = newKeys;

    for (const { id, label } of cs) {
      const match = pos.find((p) => p.id === id)!;
      this.add(match.idx, label ?? 'Unlabeled', coords, newKeys, true);
    }
    get(annoFeat).currKey = newKeys.length - 1;
    sEvent.set({ type: 'pointsAdded' });
    flashing.set('Feature Annotation');
  }
}
