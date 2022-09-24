<script lang="ts">
  import type { Sample } from '$src/lib/data/objects/sample';
  import type { Mapp } from '$src/lib/ui/mapp';
  import { onMount } from 'svelte/types/runtime/internal/lifecycle';
  export let map: Mapp;
  export let sample: Sample;

  onMount(() => {
    map.attachPointerListener({
      // pointermove: oneLRU((id_: { idx: number; id: number | string } | null) => {
      //   if (id_) $sId = { ...id_, source: 'map' };
      // })
      // click: (id_: { idx: number; id: number | string } | null) => {
      //   if (!$sOverlay) return;
      //   const ov = map.layers[$sOverlay]?.overlay;
      //   if ($annotating.currKey !== null && id_ && ov) {
      //     const idx = id_.idx;
      //     const existing = map.persistentLayers.annotations.get(idx);
      //     if (
      //       existing === null ||
      //       existing.get('value') !== $annotating.keys[$annotating.currKey]
      //     ) {
      //       map.persistentLayers.annotations.add(
      //         idx,
      //         $annotating.keys[$annotating.currKey],
      //         ov,
      //         $annotating.keys
      //       );
      //     } else {
      //       map.persistentLayers.annotations.delete(idx);
      //     }
      //   }
      // }
    });
  });
  // $: map.persistentLayers.annotations.layer?.setVisible($annotating.show);
</script>
