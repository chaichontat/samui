<script lang="ts">
  import SearchBox from '$src/lib/components/searchBox.svelte';
  import type { Sample } from '$src/lib/data/sample';
  import { currSample, store, type FeatureName, type HoverName } from '$src/lib/store';
  import type { Named } from '$src/lib/utils';
  import Scatter from './scatter.svelte';

  export let featureNames: FeatureName<string>[];
  type Name = FeatureName<string>;
  let x: HoverName<Name>;
  let y: HoverName<Name>;
  let color: HoverName<Name>;
  let coords: Named<{ x: number; y: number }[]>;

  async function getData(
    sample: Sample,
    x: HoverName<FeatureName<string>>,
    y: HoverName<FeatureName<string>>
  ) {
    let xf = sample.getFeature(x.active!);
    let yf = sample.getFeature(y.active!);

    if (xf.values instanceof Promise) {
      xf.values = (await xf.values) as number[];
    }
    if (yf.values instanceof Promise) {
      yf.values = (await yf.values) as number[];
    }

    coords = {
      name: x.active!.name! + y.active!.name!,
      values: (xf.values as number[]).map((x, i) => ({ x, y: (yf.values as number[])[i] }))
    };
  }

  $: if ($currSample && x?.active && y?.active) {
    getData($currSample.sample, x, y).catch(console.error);
  }

  async function updateColors(sample: Sample, color: HoverName<FeatureName<string>>) {
    let c = sample.getFeature(color.active!);
    if (c.values instanceof Promise) {
      c.values = await c.values;
    }

    colorValues = { name: color.active!.name, values: c.values as number[], dataType: c.dataType };
  }

  $: if ($currSample && color.active) {
    console.log(color);

    updateColors($currSample.sample, color).catch(console.error);
  }

  let colorValues: Named<number[]> = { name: 'meh', values: [], dataType: 'quantitative' };
</script>

<div class="flex items-center gap-x-2">
  x:
  <SearchBox names={featureNames} bind:curr={x} />
  y: <SearchBox names={featureNames} bind:curr={y} />
</div>

<div class="flex items-center gap-x-2">
  Color: <div class="w-full"><SearchBox names={featureNames} bind:curr={color} /></div>
</div>

<Scatter coordsSource={coords} intensitySource={colorValues} bind:currHover={$store.currIdx.idx} />
