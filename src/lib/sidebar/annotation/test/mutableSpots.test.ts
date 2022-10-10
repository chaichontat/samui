import { CoordsData } from '$src/lib/data/objects/coords';
import { Mapp } from '$src/lib/ui/mapp';
import '@testing-library/jest-dom';
import { cloneDeep } from 'lodash-es';
import Feature from 'ol/Feature';
import { Circle, Point } from 'ol/geom';
import { describe, expect, it } from 'vitest';

import { fromCSV } from '$src/lib/io';
import { schemeTableau10 } from 'd3';
import VectorSource from 'ol/source/Vector';
import { MutableSpots } from '../mutableSpots';

const map = new Mapp();
const m = map.persistentLayers.annotations.points;
const labels = ['a', 'b', 'c'];
const coordsData = new CoordsData({
  name: 'test',
  shape: 'circle',
  mPerPx: 0.1,
  pos: Array.from({ length: 10 }, (_, i) => ({ x: i, y: 0, id: i }))
});
const keyMap = { a: 0, b: 1, c: 2 };
const source = new VectorSource();
const features = coordsData.pos!.map(
  (p) => new Feature(new Point([p.x * coordsData.mPerPx, -p.y * coordsData.mPerPx]))
);
features.forEach((f, i) => f.setId(i));
source.addFeatures(features);

const runInit = () => {
  m.startDraw(cloneDeep(coordsData), keyMap, source);
};

describe('it should fail before startDraw', () => {
  it('should not run before startDraw', () => {
    expect(m.coordsSource).toBeUndefined();
    expect(() => m.add(0, labels[0])).toThrow();
    expect(() => m.addFromPolygon(new Feature(new Circle([0, 0], 1)))).toThrow();
  });
});

describe('test updateFeature', () => {
  beforeAll(runInit);
  const f = new Feature(new Point([0, 0]));

  it('should add a label', () => {
    m.updatePoint(f, labels[0]);
    expect(f.get('label')).toBe(labels[0]);
    expect(f.get('color')).toBe(schemeTableau10[0].concat('cc'));
  });

  it('should add a label to an existing one', () => {
    m.updatePoint(f, labels[1]);
    expect(f.get('label')).toBe(labels.slice(0, 2).join(','));
    expect(f.get('color')).toBe(schemeTableau10[1].concat('cc'));
  });

  it('should not stack the same label on top of one another', () => {
    m.updatePoint(f, labels[1]);
    expect(f.get('label')).toBe(labels.slice(0, 2).join(','));
    expect(f.get('color')).toBe(schemeTableau10[1].concat('cc'));
  });

  it('should make the latest label the rightmost one', () => {
    m.updatePoint(f, labels[0]);
    expect(f.get('label')).toBe([labels[1], labels[0]].join(','));
    expect(f.get('color')).toBe(schemeTableau10[0].concat('cc'));
  });

  it('should remove the rightmost label', () => {
    m.updatePoint(f, labels[0], true);
    expect(f.get('label')).toBe(labels[1]);
    expect(f.get('color')).toBe(schemeTableau10[1].concat('cc'));
  });

  it('should remove all labels', () => {
    m.updatePoint(f, labels[1], true);
    expect(f.get('label')).toBe(undefined);
    expect(f.get('color')).toBe(undefined);
  });

  it('should handle 3 labels', () => {
    m.updatePoint(f, labels[0]);
    m.updatePoint(f, labels[1]);
    m.updatePoint(f, labels[2]);
    expect(f.get('label')).toBe(labels.join(','));
    expect(f.get('color')).toBe(schemeTableau10[2].concat('cc'));

    m.updatePoint(f, labels[1], true);
    expect(f.get('label')).toBe([labels[0], labels[2]].join(','));

    m.updatePoint(f, labels[2], true);
    expect(f.get('label')).toBe(labels[0]);
    expect(f.get('color')).toBe(schemeTableau10[0].concat('cc'));
  });
});

describe.concurrent('fresh start', () => {
  beforeEach(runInit);

  it('should add a point', () => {
    const idx = 0;
    m.add(idx, labels[0]);
    expect(MutableSpots.getLabel(m.source.getFeatureById(idx)!)).toBe(labels[0]);
  });

  it('should add multiple points', () => {
    const idxs = [1, 2, 3, 4];
    m.add(idxs, labels[0]);
    for (const idx of idxs) {
      expect(MutableSpots.getLabel(m.source.getFeatureById(idx)!)).toBe(labels[0]);
    }
  });
});

describe.concurrent('circle test', () => {
  beforeEach(runInit);
  const oldCircle = new Feature(new Circle([0, 0], 0.501)); // Floating point
  oldCircle.set('label', 'a');
  const newCircle = new Feature(new Circle([0, 0], 0.601));
  newCircle.set('label', 'b');

  it('should add and delete from polygon', () => {
    m.addFromPolygon(oldCircle);
    expect(m.length).toBe(6);
    expect(m.source.getFeatures().every((f) => MutableSpots.getLabel(f))).toBe(true);

    m.addFromPolygon(newCircle);
    expect(m.length).toBe(7);
    expect(m.source.getFeatures().every((f) => MutableSpots.getLabel(f) === 'b')).toBe(true);

    m.deleteFromPolygon(newCircle);
    expect(m.length).toBe(6);

    m.deleteFromPolygon(oldCircle);
    expect(m.length).toBe(0);

    m.addFromPolygon(oldCircle);
    m.addFromPolygon(oldCircle);
    expect(m.length).toBe(6);
  });

  it('should return correct composition', () => {
    m.addFromPolygon(newCircle);
    m.addFromPolygon(oldCircle);
    expect(m.getComposition()).toEqual({ a: 6, b: 1, total_: 7 });
  });

  it('should handle relabel', () => {
    m.addFromPolygon(oldCircle);
    m.addFromPolygon(newCircle);
    m.relabel('b', 'a');
    expect(m.getComposition()).toEqual({ a: 7, total_: 7 });
  });

  it('should handle relabel with no change', () => {
    m.addFromPolygon(newCircle);
    m.addFromPolygon(oldCircle);
    m.relabel('b', 'b');
    expect(m.getComposition()).toEqual({ a: 6, b: 1, total_: 7 });
  });

  it('should dump and load', async () => {
    m.addFromPolygon(newCircle);
    m.addFromPolygon(oldCircle);
    const dump = m.dump();
    m.clear();
    expect(m.length).toBe(0);
    const csved = (await fromCSV(dump))!.data as { id: number; label: string }[];
    console.log(csved);

    m.load(csved, coordsData, source);
    expect(m.getComposition()).toEqual({ a: 6, b: 1, total_: 7 });
  });

  it('should clear', () => {
    m.addFromPolygon(newCircle);
    m.clear();
    expect(m.length).toBe(0);
    expect(m.coordsSource).toBeUndefined();
    expect(m.keyMap).toBeUndefined();
  });
});
