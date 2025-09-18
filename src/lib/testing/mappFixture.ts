import { render } from 'vitest-browser-svelte';
import type { CoordsData } from '$src/lib/data/objects/coords';
import type { Mapp } from '$src/lib/ui/mapp';
import Harness from './MappHarness.svelte';

type HarnessRender = ReturnType<typeof render<typeof Harness>>;

export async function renderMappHarness({
  coords,
  highlightIdx = 0
}: {
  coords: CoordsData;
  highlightIdx?: number;
}): Promise<{
  map: Mapp;
  cleanup: () => void;
  harness: HarnessRender;
}> {
  let resolveReady!: (value: Mapp) => void;
  const ready = new Promise<Mapp>((resolve) => {
    resolveReady = resolve;
  });

  const harness = render(Harness, {
    props: { coords, highlightIdx, onReady: (map) => resolveReady(map) }
  });

  const map = await ready;
  await map.promise;
  await new Promise((resolve) => setTimeout(resolve, 0));

  const cleanup = () => harness.unmount();

  return { map, cleanup, harness };
}
