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

  // Feature change.
  // $: if (sample && $sOverlay && $sFeature[$sOverlay]) {
  //   const ol = $sOverlay;
  //   updateFeature({
  //     key: `${sample.name}-${$sFeature[ol].group}-${$sFeature[ol].feature}`,
  //     args: [$sFeature[ol]]
  //   }).catch(console.error);
  // }

  // const genCoords = keyLRU((name: string, pos: Record<string, number>[], mPerPx: number) => {
  //   return new CoordsData({
  //     name,
  //     shape: 'circle',
  //     pos,
  //     mPerPx
  //   });
  // });

  // const updateFeature = keyOneLRU(async (fn: FeatureAndGroup) => {
  //   if (!fn.feature) return false;
  //   const res = await sample!.getFeature(fn);
  //   if (!res) return false;

  //   const mPerPx = res.mPerPx ?? sample?.image?.mPerPx;
  //   if (mPerPx == undefined) {
  //     console.error(`mPerPx is undefined at ${fn.feature}.`);
  //     return false;
  //   }

  //   if (res.coordName) {
  //     $overlays[$sOverlay].update(sample!.coords[res.coordName]);
  //   } else {
  //     if (!('x' in res.data[0]) || !('y' in res.data[0])) {
  //       console.error("Feature doesn't have x or y.");
  //       return false;
  //     }
  //     $overlays[$sOverlay].update(
  //       genCoords({
  //         key: `${sample!.name}-${fn.group}-${fn.feature}`,
  //         args: [fn.feature, res.data, mPerPx]
  //       })
  //     );
  //   }

  //   $overlays[$sOverlay]?.updateProperties(res);
  //   if (!map.map?.getView().getCenter()) {
  //     let mx = 0;
  //     let my = 0;
  //     let max = [0, 0];
  //     for (const { x, y } of res.data) {
  //       mx += Number(x);
  //       my += Number(y);
  //       max[0] = Math.max(max[0], Number(x));
  //       max[1] = Math.max(max[1], Number(y));
  //     }
  //     mx /= res.data.length;
  //     my /= res.data.length;
  //     console.log(res.data, mx, my);

  //     // TODO: Deal with hard-coded zoom.
  //     map.map?.setView(
  //       new View({
  //         center: [mx * mPerPx, -my * mPerPx],
  //         projection: 'EPSG:3857',
  //         resolution: 1e-4,
  //         minResolution: 1e-7,
  //         maxResolution: Math.max(max[0], max[1]) * mPerPx
  //       })
  //     );
  //   }
  // });

  // Hover/overlay.
  // $: if (sample && $sOverlay) changeHover($sOverlay, $sId.idx).catch(console.error);

  // const changeHover = oneLRU(async (activeol: string, idx: number | null) => {
  //   await sample!.promise;
  //   const active = map.persistentLayers.active;
  //   const ov = $overlays[activeol];

  //   if (!ov) return false;

  //   if (idx !== null && ov.coords) {
  //     active.layer!.setVisible(true);
  //     const pos = ov.coords.pos![idx];
  //     if (!pos) return; // Happens when changing focus.overlay. Idx from another ol can exceed the length of current ol.
  //     active.update(ov.coords, idx);
  //     if (map.tippy && pos.id) {
  //       map.tippy.overlay.setPosition([pos.x * ov.coords.mPerPx, -pos.y * ov.coords.mPerPx]);
  //       map.tippy.elem.removeAttribute('hidden');
  //       map.tippy.elem.innerHTML = `<code>${pos.id}</code>`;
  //     }
  //   } else {
  //     active.layer!.setVisible(false);
  //     map.tippy?.elem.setAttribute('hidden', '');
  //   }
  // });
</script>
