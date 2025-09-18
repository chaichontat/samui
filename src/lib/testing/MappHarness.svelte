<script lang="ts">
  import { onMount } from 'svelte';
  import type { CoordsData } from '$src/lib/data/objects/coords';
  import { Mapp } from '$src/lib/ui/mapp';

  export let coords: CoordsData;
  export let highlightIdx = 0;
  export let onReady: ((value: Mapp) => void) | undefined;

  let mapElem: HTMLDivElement;
  let tipElem: HTMLDivElement;
  let map: Mapp | undefined;

  onMount(() => {
    map = new Mapp();
    map.mount(mapElem, tipElem);
    map.persistentLayers.active.visible = true;
    onReady?.(map);
  });

  $: if (map?.mounted && coords) {
    map.persistentLayers.active.visible = true;
    map.persistentLayers.active.update(coords, highlightIdx);
  }
</script>

<div
  data-testid="ol-map"
  bind:this={mapElem}
  style="width: 400px; height: 300px; position: relative;"
></div>
<div
  data-testid="ol-tip"
  bind:this={tipElem}
  style="position: absolute; inset: 0; pointer-events: none;"
></div>
