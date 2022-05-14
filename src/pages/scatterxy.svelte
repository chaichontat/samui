<script lang="ts">
  import SearchBox from '$src/lib/components/searchBox.svelte';
  import type { NameWithFeature } from '$src/lib/data/features';
  import type { Sample } from '$src/lib/data/sample';
  import { boxMuller } from '$src/lib/scatter/scatterlib';
  import {
    activeSample,
    samples,
    store,
    type HoverName,
    type NameWithFeatures
  } from '$src/lib/store';
  import type { Named } from '$src/lib/utils';
  import Scatter from './scatter.svelte';

  export let names: NameWithFeatures[];

  type Name = NameWithFeature;
  let x: HoverName<Name>;
  let y: HoverName<Name>;
  let color: HoverName<Name>;
  let coords: Named<{ x: number; y: number }[]>;

  let values: { x: number[]; y: number[] };
  let range: { x: number; y: number } = { x: 0, y: 0 };

  let jitterX = 0;
  let jitterY = 0;

  async function getData(
    sample: Sample,
    x: HoverName<NameWithFeature>,
    y: HoverName<NameWithFeature>,
    jitterX = 0,
    jitterY = 0
  ) {
    let xf = sample.getFeature(x.active!);
    let yf = sample.getFeature(y.active!);

    if (xf.values instanceof Promise) {
      xf.values = (await xf.values) as number[];
    }
    if (yf.values instanceof Promise) {
      yf.values = (await yf.values) as number[];
    }

    values = { x: xf.values as number[], y: yf.values as number[] };
    range = {
      x: Math.max(...values.x) - Math.min(...values.x),
      y: Math.max(...values.y) - Math.min(...values.y)
    };

    coords = {
      name: `${sample.name}--${x.active!.name!}--${y.active!.name!}--${jitterX}--${jitterY}`,
      values: (xf.values as number[]).map((x, i) => ({
        x: x + (jitterX !== 0 ? boxMuller(jitterX) : 0),
        y: values.y[i] + (jitterY !== 0 ? boxMuller(jitterY) : 0)
      }))
    };
  }

  async function updateColors(sample: Sample, color: HoverName<NameWithFeature>) {
    let c = sample.getFeature(color.active!);
    if (c.values instanceof Promise) {
      c.values = await c.values;
    }

    colorValues = {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      name: `${sample.name}-${color.active!.name}`,
      values: c.values as number[],
      dataType: c.dataType
    };
  }

  $: sample = $samples[$activeSample];

  $: if (sample && x?.active && y?.active) {
    console.log('changed data');
    getData(sample, x, y, jitterX, jitterY).catch(console.error);
  }

  $: if (sample && color?.active) {
    console.log(color);
    updateColors(sample, color).catch(console.error);
  }

  let colorValues: Named<number[]> = { name: 'meh', values: [], dataType: 'quantitative' };
</script>

<div class="flex flex-col items-center gap-y-1">
  <div class="flex max-w-md items-center gap-x-2">
    x:
    <SearchBox {names} bind:curr={x} />
    y: <SearchBox {names} bind:curr={y} />
  </div>

  <div class="flex max-w-md items-center gap-x-2">
    Color:
    <div class="">
      <SearchBox {names} bind:curr={color} />
    </div>
  </div>

  <div>
    <input
      type="range"
      min="0"
      max={0.1 * range.x}
      step={(0.1 * range.x) / 100}
      bind:value={jitterX}
    />
    <input
      type="range"
      min="0"
      max={0.1 * range.y}
      step={(0.1 * range.y) / 100}
      bind:value={jitterY}
    />
  </div>

  <Scatter
    coordsSource={coords}
    intensitySource={colorValues}
    bind:currHover={$store.currIdx.idx}
  />
</div>
