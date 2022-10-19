import { Feature } from 'ol';
import type { Geometry } from 'ol/geom';

export class FeatureLabel<T extends Geometry> extends Feature<T> {
  // Must have id, idx, and label.
  getLabel(returnAll?: false): string | undefined;
  getLabel(returnAll: true): string[] | undefined;
  getLabel(returnAll = false) {
    const labels = (this.get('label') as string | undefined)?.split(',');
    if (returnAll) return labels;
    return labels?.at(-1);
  }

  removeLabel(label?: string) {
    const labels = this.getLabel(true) ?? [];
    const idxMatch = labels.findIndex((x) => x === label);
    if (idxMatch > -1) {
      labels.splice(idxMatch, 1);
    }
    this.set('label', labels.length ? labels.join(',') : undefined);
    return labels.at(-1);
  }

  addLabel(label: string) {
    // Returns current label.
    if (label == undefined) throw new Error('label is undefined');
    const labels = this.getLabel(true) ?? [];
    const idxMatch = labels.findIndex((x) => x === label);
    if (labels.length && idxMatch === labels.length - 1) return label; // Don't add the same label twice.
    if (idxMatch > -1) {
      labels.splice(idxMatch, 1); // Move new one to latest.
    }
    labels.push(label); // A stack.
    this.set('label', labels.join(','));
    return label;
  }
}
