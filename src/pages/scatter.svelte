<script lang="ts">
  import Colorbar from '$src/lib/components/colorbar.svelte';
  import { Charts } from '$src/lib/scatter/scatterlib';
  import genColormap from 'colormap';
  import { onMount } from 'svelte';

  const id = Math.random();
  export let colormap = 'viridis';
  export let colorbar = false;
  export let coordsSource: { x: number; y: number }[];
  export let minmax: 'auto' | [number, number] = 'auto';

  export let intensitySource: number[] | Promise<number[]>;
  export let opacity = 'ff';
  export let pointRadius = 2.5;

  const charts = new Charts();
  const colors = genColormap({ colormap, nshades: 256, format: 'hex' });

  const update = async ({
    coords,
    intensity
  }: {
    coords: { x: number; y: number }[];
    intensity: number[] | Promise<number[]>;
  }) => {
    if (coords) await updateCoords(coords);
    if (intensity) await updateIntensity(intensity);
  };

  const updateCoords = async (c: { x: number; y: number }[]) => await charts.update({ coords: c });

  const updateIntensity = async (intensity: number[] | Promise<number[]>) => {
    const out = [];
    if (intensity instanceof Promise) {
      intensity = await intensity;
    }

    if (!intensity.every((x) => x !== undefined)) {
      console.error('Intensity source is not ready.');
      return;
    }

    // TODO get percentile
    const thresh = 10; // minmax === 'auto' ? Math.max(...intensitySource) : minmax[1];
    for (const d of intensity) {
      const idx = Math.round(Math.min((d ?? 0) / thresh, 1) * 255);
      out.push(colors[idx] + opacity);
    }
    await charts.update({ color: out });
  };

  onMount(() => {
    charts.mount(
      document.getElementById(`${id}-main`) as HTMLCanvasElement,
      document.getElementById(`${id}-hover`) as HTMLCanvasElement
    );
    update({ coords: coordsSource, intensity: intensitySource }).catch(console.error);
  });

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
