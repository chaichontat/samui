import type { CoordsData } from '$src/lib/data/objects/coords';
import { annoFeat, annoROI, sEvent, sFeatureData, sOverlay } from '$src/lib/store';
import { isEqual } from 'lodash-es';
import type { Feature } from 'ol';
import type { Circle, Geometry, Polygon } from 'ol/geom.js';
import type { ModifyEvent } from 'ol/interaction/Modify';
import type { TranslateEvent } from 'ol/interaction/Translate';
import { get } from 'svelte/store';
import type { Mapp } from '../../ui/mapp';
import { Draww } from './annROI';
import type { MutableSpots } from './mutableSpots';

export class DrawFeature extends Draww {
  readonly points: MutableSpots;

  // Comparison point for points after modifying event.
  featuresBeforeMod: Record<number, Feature<Geometry>> = {};
  coordsSource?: CoordsData;

  constructor(map: Mapp, store: typeof annoROI, mutspot: MutableSpots) {
    super(map, store);
    this.points = mutspot;
  }

  afterModify(e: ModifyEvent | TranslateEvent) {
    console.debug('modifyend');
    const keyIdx = get(this.store as typeof annoFeat).currKey;
    if (keyIdx == undefined) throw new Error('keyIdx is null');

    const feature = e.features.getArray()[0] as Feature<Polygon>;
    const idx = feature.getId() as number;
    const prev = this.featuresBeforeMod[idx];
    this.points.deleteFromPolygon(prev as Feature<Polygon | Circle>);
    this.points.addFromPolygon(
      feature,
      get(annoFeat).keys[keyIdx],
      this.coordsSource!,
      get(annoFeat).keys
    );
    this.featuresBeforeMod[idx] = feature.clone();
  }

  mount() {
    super.mount();
    this.points.mount();
    this.modify.on('modifyend', (e: ModifyEvent) => this.afterModify(e));
    this.translate.on('translateend', (e: TranslateEvent) => this.afterModify(e));

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
            this.points.add(idx, anno.keys[anno.currKey], sfd.coords, anno.keys);
          } else {
            this.points.remove(idx);
          }
        }
      }
    });
  }

  startDraw(coords: CoordsData) {
    console.log('Start drawing at', coords.name);
    this.coordsSource = coords;
  }

  getComposition() {
    return this.points.getComposition();
  }

  processFeature(feature: Feature<Polygon | Circle>, color: string, label: string, newDraw = true) {
    super.processFeature(feature, color, label);
    if (newDraw) {
      this.featuresBeforeMod[feature.getId() as number] = feature.clone();
    }
    this.points.addFromPolygon(
      feature,
      get(annoFeat).keys[get(this.store as typeof annoFeat).currKey!],
      this.coordsSource!,
      get(annoFeat).keys
    );
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
    for (const f of this.source.getFeatures()) {
      if (f.get('label') === old) {
        f.set('label', newlabel);
        this.points.relabel(old, newlabel);
      }
    }
    sEvent.set({ type: 'pointsAdded' });
  }

  clear() {
    super.clear();
    this.points.clear();
  }

  dumpPoints() {
    return this.points.dump();
  }
}
