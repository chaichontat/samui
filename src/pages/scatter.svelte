<script lang="ts">
  import Colorbar from '$src/lib/components/colorbar.svelte';
  import { Charts } from '$src/lib/scatter/scatterlib';
  import { store } from '$src/lib/store';
  import { keyLRU, keyOneLRU, type Named } from '$src/lib/utils';
  import genColormap from 'colormap';
  import { onMount } from 'svelte';

  const id = Math.random();

  export let colormap = 'viridis';
  export let colorbar = false;
  export let coordsSource: Named<{ x: number; y: number }[]>;
  export let minmax: 'auto' | [number, number] = 'auto';

  export let intensitySource: Named<number[] | Promise<number[]>>;
  export let opacity = 'ff';
  export let pointRadius = 2.5;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  // export let onHover: (idx: number) => void = () => {};
  // export let hoverOptions: ChartOptions<'scatter'> = {} as ChartOptions<'scatter'>;

  const charts = new Charts({ onHover: handleHover });

  function handleHover(idx: number) {
    $store.currIdx = { idx, source: 'scatter' };
  }

  const _color256 = genColormap({ colormap, nshades: 256, format: 'hex' });
  let colors: string[];

  const update = async ({
    coords,
    intensity
  }: {
    coords: Named<{ x: number; y: number }[]>;
    intensity: Named<number[] | Promise<number[]>>;
  }) => {
    if (coords) {
      await updateCoords({ key: coords.name, args: [coords.values] });
    }

    if (intensity.values) {
      if (intensity.values instanceof Promise) {
        intensity.values = await intensity.values;
      }

      if (intensity.values) {
        colors = calcColor({ key: coords.name + intensity.name, args: [intensity.values] });
        await updateColors({ key: coords.name + intensity.name, args: [colors] });
      }
    }
  };

  const calcColor = keyLRU((intensity: number[]) => {
    const out = [];
    if (!intensity.every((x) => x !== undefined)) {
      throw new Error('Intensity source is not ready.');
    }

    // TODO get percentile
    const thresh = 10; // minmax === 'auto' ? Math.max(...intensitySource) : minmax[1];
    for (const d of intensity) {
      const idx = Math.round(Math.min((d ?? 0) / thresh, 1) * 255);
      out.push(_color256[idx] + opacity);
    }
    return out;
  });

  const updateCoords = keyOneLRU(
    async (c: { x: number; y: number }[]) => await charts.update({ coords: c })
  );
  const updateColors = keyOneLRU(async (color: string[]) => {
    await charts.update({ color });
  });

  onMount(() => {
    charts.mount(
      document.getElementById(`${id}-main`) as HTMLCanvasElement,
      document.getElementById(`${id}-hover`) as HTMLCanvasElement
    );
    update({ coords: coordsSource, intensity: intensitySource }).catch(console.error);
  });

  $: if ($store.currIdx.source !== 'scatter') charts.triggerHover($store.currIdx.idx);
  $: update({ coords: coordsSource, intensity: intensitySource }).catch(console.error);
</script>

<div class="relative mx-auto w-full max-w-[400px]">
  {#if colorbar}
    <Colorbar min={0} max={10} />
  {/if}
  <canvas class="absolute" id={`${id}-hover`} />
  <canvas class="" id={`${id}-main`} />
  <!-- <div
    class="absolute left-10 top-10 z-10 rounded-lg bg-white/10 px-3 py-1 text-lg font-medium text-white opacity-90 backdrop-blur-sm"
  >
  </div> -->
</div>
