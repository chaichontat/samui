import type { CoordsData } from '$src/lib/data/objects/coords';
import {
  annoFeat,
  annoHover,
  annoROI,
  overlays,
  sEvent,
  sFeatureData,
  sOverlay
} from '$src/lib/store';
import { isEqual, throttle } from 'lodash-es';
import type { Feature } from 'ol';
import type { Circle, Geometry, Polygon } from 'ol/geom.js';
import { get } from 'svelte/store';
import type { Mapp } from '../../ui/mapp';
import { Draww, type ROIData } from './annROI';
import type { MutableSpots } from './mutableSpots';

export interface AnnFeatData extends ROIData {
  coordName: string;
}

export class DrawFeature extends Draww {
  readonly points: MutableSpots;

  // Comparison point for points after modifying event.
  featuresBeforeMod: Record<number, Feature<Geometry>> = {};
  coordsSource?: CoordsData;
  pendingPolygons: Feature<Polygon | Circle>[] = [];

  constructor(map: Mapp, store: typeof annoROI, mutspot: MutableSpots) {
    super(map, store);
    this.points = mutspot;
  }

  afterModify(feature: Feature<Geometry>) {
    // console.debug('modifyend', feature);
    const keyIdx = get(this.store as typeof annoFeat).currKey;
    if (keyIdx == undefined) throw new Error('keyIdx is null');

    const idx = feature.getId() as number;
    const prev = this.featuresBeforeMod[idx];
    this.points.modifyFromPolygon(
      prev as Feature<Polygon | Circle>,
      this.source.getFeatures().filter((f) => f.get('label') === feature.get('label')) as Feature<
        Polygon | Circle
      >[]
    );
    this.featuresBeforeMod[idx] = feature.clone();
  }

  mount() {
    this.points.mount();
    super.mount(); // So that text is drawn on top of points.
    this.map.attachPointerListener({
      click: (id_: { idx: number; id: number | string } | null) => {
        const anno = get(this.store as typeof annoFeat);
        if (!get(sOverlay) || !(anno.selecting === 'Select')) return;

        const sfd = get(sFeatureData);
        if (!isEqual(sfd.coords.name, anno.annotating?.coordName)) {
          alert(
            `Annotation: coords mismatch. Started with ${anno.annotating!.coordName} but now ${
              sfd.coords.name
            }`
          );
          return;
        }

        if (anno.currKey != undefined && id_ && sfd) {
          const idx = id_.idx;
          const existing = this.points.get(idx);
          if (existing == undefined || existing.get('value') !== anno.keys[anno.currKey]) {
            console.debug('Adding point', idx, anno.currKey);
            this.points.add(idx, anno.keys[anno.currKey]);
          }
        }
      }
    });
    this.map.attachPointerListener(
      {
        pointermove(obj) {
          if (!obj) {
            annoHover.set(undefined);
            return;
          }
          const label = obj.feature.get('keyIdx') as number;
          if (label == undefined) console.error('No label for feature', obj.f);
          annoHover.set(label);
        }
      },
      { layer: this.selectionLayer }
    );
  }

  loadFeatures(obj: AnnFeatData): void {
    const { coordName } = obj;
    const coords = get(sFeatureData).coords;
    if (coordName !== coords.name) {
      alert(
        `Annotation: coords mismatch. \
Got ${coordName} but current feature has ${coords.name}.`
      );
      return;
    }
    this.startDraw(coords);
    super.loadFeatures(obj);
  }

  startDraw(coords: CoordsData) {
    console.log('Start drawing at', coords.name);
    this.coordsSource = coords;
    this.points.startDraw(coords, get(annoFeat).reverseKeys, get(overlays)[get(sOverlay)].source);
    annoFeat.update((state) => ({ ...state, ready: true }));
    const queued = this.pendingPolygons.splice(0);
    queued.forEach((feature) => this.points.addFromPolygon(feature));
    sEvent.set({ type: 'pointsAdded' });
  }

  getCounts() {
    return this.points.getCounts();
  }

  processFeature(
    feature: Feature<Polygon | Circle>,
    color: string,
    label: string,
    keyIdx: number,
    newDraw = true
  ) {
    if (feature.getId() == undefined) {
      // Listener for any change in the geometry.
      feature.getGeometry()!.on(
        'change',
        throttle(() => {
          this.onDrawEnd_(feature);
          this.afterModify(feature);
        }, 25)
      );
    }
    super.processFeature(feature, color, label, keyIdx, newDraw);

    if (newDraw) {
      this.featuresBeforeMod[feature.getId() as number] = feature.clone();
    }
    this.points.addFromPolygon(feature);
  }

  removeFeature(f: Feature<Polygon | Circle>): void {
    super.removeFeature(f);
    this.points.deleteFromPolygon(f);
    delete this.featuresBeforeMod[f.getId() as number];
  }

  removeFeaturesByLabel(label: string) {
    super.removeFeaturesByLabel(label);
    this.points.removeByLabel(label);
  }

  relabel(old: string, newlabel: string): void {
    super.relabel(old, newlabel);
    this.points.relabel(old, newlabel);
    sEvent.set({ type: 'pointsAdded' });
  }

  clear() {
    annoFeat.update((state) => ({ ...state, ready: false }));
    this.pendingPolygons = [];
    super.clear();
    this.points.clear();
  }

  dumpPoints() {
    return this.points.dump();
  }
}
