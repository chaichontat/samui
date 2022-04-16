import { browser } from '$app/env';
import { Sample } from '$src/lib/data/sample';

export const s = 'Br6522_Ant_IF';

const sample = new Sample(
  s,
  { headerUrl: `${s}/image.json`, urls: [`/cogs/${s}_1.tif`, `/cogs/${s}_2.tif`] },
  [
    {
      name: 'genes',
      type: 'chunkedJSON',
      headerUrl: `${s}/header.json`,
      url: '/Br6522_Ant_IF/Counts_Br6522_Ant_IF.dump'
    }
  ]
);

export default browser ? sample.hydrate() : undefined;
