<script lang="ts">
  import Colorbar from '$src/lib/components/colorbar.svelte';
  import type { Mapp } from '$src/lib/mapp/mapp';
  import SelectionBox from '$src/lib/mapp/selectionBox.svelte';
  import { oneLRU } from '$src/lib/utils';
  import { onMount } from 'svelte';

  export let map: Mapp;
  export let selecting: boolean;

  onMount(async () => {
    await map.promise;
    map.draw!.draw.on('drawend', () => (selecting = false));
    map.draw!.source.on('addfeature', () => {
      const name = prompt('Name of selection');
      map.draw!.setPolygonName(-1, name ?? 'Selection');
      updateSelectionNames();
    });
  });

  let selectionNames: string[] = [];
  function updateSelectionNames() {
    selectionNames = map.draw?.getPolygonsName() ?? [];
    console.log(selectionNames);
  }

  let colorOpacity = 0.8;

  const setSpotVisible = (c: boolean | null) => map.layerMap.spots.layer?.setVisible(c ?? false);
  const setOpacity = oneLRU(async (opacity: string) => {
    await map.layerMap.spots.promise;
    map.layerMap.spots.layer!.updateStyleVariables({ opacity: Number(opacity) });
  });
</script>

<section class="absolute top-16 right-4 z-20 flex flex-col items-end gap-3 md:top-4">
  <!-- Select button -->
  <div class="flex space-x-2">
    <SelectionBox
      names={selectionNames}
      on:delete={(evt) => {
        map.draw?.deletePolygon(evt.detail.i);
        updateSelectionNames();
      }}
      on:hover={(evt) => map.draw?.highlightPolygon(evt.detail.i)}
    />
    <button
      class="rounded-lg bg-sky-600/80 px-2 py-1 text-sm text-white shadow backdrop-blur transition-all hover:bg-sky-600/80 active:bg-sky-500/80 dark:bg-sky-700/70 dark:text-slate-200 dark:hover:bg-sky-600/80"
      class:bg-slate-600={selecting}
      class:hover:bg-slate-600={selecting}
      class:active:bg-slate-600={selecting}
      on:click={() => (selecting = true)}
      disabled={selecting}
      ><svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5 stroke-current stroke-2"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    </button>
  </div>

  <!-- Show all spots -->
  <div
    class="inline-flex flex-col gap-y-1 rounded-lg bg-slate-100/80 p-2 px-3 text-sm font-medium backdrop-blur-sm transition-all hover:bg-slate-200/80 dark:bg-neutral-600/70 dark:text-white/90 dark:hover:bg-neutral-600/90"
  >
    <label class="cursor-pointer">
      <input
        type="checkbox"
        class="mr-0.5 cursor-pointer opacity-80"
        checked
        on:change={(e) => setSpotVisible(e.currentTarget.checked)}
      />
      <span>Show all spots</span>
    </label>

    <input
      type="range"
      min="0"
      max="1"
      value="0.9"
      step="0.01"
      on:change={(e) => setOpacity(e.currentTarget.value)}
      on:mousemove={(e) => setOpacity(e.currentTarget.value)}
      on:mousedown={() => setSpotVisible(true)}
      class="max-w-[36rem] cursor-pointer opacity-80"
    />
  </div>

  <div class="relative mt-2">
    <Colorbar class="right-6" bind:opacity={colorOpacity} color="yellow" min={0} max={10} />
  </div>
</section>
