export type Childless = { thisMap: number };
export type Childmore = { split?: 'h' | 'v'; maps: [Hie, Hie] };
export type Hie = Childless | Childmore;

export function splitTile(h: Hie, mode: 'h' | 'v'): Hie {
  if ('maps' in h) throw new Error('split only works on single-level hierarchies');
  return {
    split: mode,
    maps: [{ thisMap: h.thisMap }, { thisMap: 5 }]
  };
}

export function deleteTile(h: Hie, i: 0 | 1) {
  if ('thisMap' in h) throw new Error('del only works on hierarchies with two levels');
  if (!isLeaf(h.maps[i])) throw new Error('not leaf');
  return h.maps[1 - i];
}

export function isLeaf(h: Hie) {
  return 'thisMap' in h && !('maps' in h);
}
