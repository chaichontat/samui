import type { FeatureName } from '../store';
import { ChunkedJSON, PlainJSON, type Data } from './dataHandlers';

export async function updateNames(features: Record<string, Data>) {
  let names: FeatureName<string>[] = [];
  for (const [name, f] of Object.entries(features)) {
    if (!f.isFeature) continue;

    if (f instanceof PlainJSON) {
      names.push({ name });
    } else if (f instanceof ChunkedJSON) {
      await f.promise;
      if (f.header!.names) {
        names = names.concat(
          Object.keys(f.header!.names).map((name) => ({ feature: f.name, name }))
        );
      }
    } else {
      throw new Error('Unknown feature type');
    }
  }
  return names;
}
