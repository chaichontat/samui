import * as d3 from 'd3';
import type Feature from 'ol/Feature.js';
import type { Circle, Geometry, Polygon } from 'ol/geom.js';

import type { Coord, CoordsData } from '$lib/data/objects/coords';
import {} from '$src/lib/data/objects/feature';
import type { Sample } from '$src/lib/data/objects/sample';
import { sEvent, sFeatureData, sOverlay } from '$src/lib/store';
import { CanvasSpots } from '$src/lib/ui/overlays/points';

import { Fill, RegularShape, Stroke, Style } from 'ol/style.js';

export class MutableSpots extends CanvasSpots {
  mount() {
    super.mount();
    this.layer!.setZIndex(Infinity);
    return this;
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

  addMultiple(idxs: number[], label: string, ov: CoordsData, ant: string[]) {
    const toAdd = [];
    for (const idx of idxs) {
      let f = this.get(idx);
      if (f == undefined) {
        f = CanvasSpots._genCircle({ ...ov.pos![idx], idx, mPerPx: ov.mPerPx, size: null });
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
    const template = [];
    for (let i = 0; i < ov.pos!.length; i++) {
      template.push(CanvasSpots._genCircle({ ...ov.pos![i], mPerPx: ov.mPerPx!, size: null }));
    }

    const filtered = ov
      .pos!.filter((f) => polygon.intersectsCoordinate([f.x * ov.mPerPx!, -f.y * ov.mPerPx!]))
      .map((p) => p.idx);

    this.addMultiple(filtered, label, ov, ant);
  }

  deleteFromPolygon(polygonFeat: Feature<Polygon | Circle>) {
    const polygon = polygonFeat.getGeometry()!;
    this.source.forEachFeatureIntersectingExtent(polygon.getExtent(), (f) => {
      this.source.removeFeature(f);
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
}
