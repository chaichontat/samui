<script lang="ts">
  import { mask, sEvent, sFeatureData, sId } from '$lib/store';
  import type { FeatureAndGroup } from '$src/lib/data/objects/feature';
  import { oneLRU } from '$src/lib/lru';
  import * as d3 from 'd3';
  import { isEqual, throttle } from 'lodash-es';
  import { onMount } from 'svelte';
  let div: HTMLDivElement;

  let minmax = [0, 10];

  type AxisOption = {
    type?: d3.ScaleContinuousNumeric<number, number>;
    domain?: [number, number];
    range?: [number, number];
    label?: string;
    format?: (d: number) => string;
  };

  type HistOptions = {
    x: (d: any) => number;
    y: (d: any) => number;
    format: (d: number) => string;
    normalize: boolean;
    margin: { top: number; right: number; bottom: number; left: number };
    height: number;
    width: number;
    inset: { left: number; right: number };
    xOpts: Partial<AxisOption>;
    yOpts: Partial<AxisOption>;
    color: string;
    textSize: number;
  };

  function Histogram<T = number[]>(
    data: T[],
    {
      x = (d) => d, // given d in data, returns the (quantitative) x-value
      y = () => 1, // given d in data, returns the (quantitative) weight
      width = 320, // outer width of chart, in pixels
      height = 160, // outer height of chart, in pixels
      margin = { top: 20, right: 20, bottom: 20, left: 25 }, //{ top: 30, right: 30, bottom: 30, left: 40 },
      inset = { left: 0.5, right: 0.5 }, // inset left edge of bar
      xOpts = { type: d3.scaleLinear, domain: [0, 10] },
      yOpts = { type: d3.scaleLinear, label: '↑ Frequency' },
      normalize = false,
      textSize = 10
    }: Partial<HistOptions> = {}
  ) {
    const xRange = [margin.left, width - margin.right];
    const yRange = [height - margin.bottom, margin.top];
    // Compute values.
    const X = d3.map(data, x);
    const Y0 = d3.map(data, y);
    const I = d3.range(X.length);

    // Compute bins.
    const bins = d3
      .bin()
      // .thresholds(thresholds)
      .value((i) => X[i])(I);
    for (const bin of bins) {
      if (bin.x0 === undefined || bin.x1 === undefined) {
        throw new Error('bin.x0 or bin.x1 is undefined');
      }
    }
    const Ybinned = Array.from(bins, (I) => d3.sum(I, (i) => Y0[i]));
    console.log(Ybinned);

    if (normalize) {
      const total = d3.sum(Ybinned);
      Ybinned.forEach((y, i) => (Ybinned[i] = y / total));
    }

    // Compute default domains.
    const xDomain = xOpts?.domain ?? [bins[0].x0!, bins[bins.length - 1].x1!];
    const yDomain = yOpts?.domain ?? [0, d3.max(Ybinned)!];

    // Construct scales and axes.
    const xScale = d3.scaleLinear(xDomain, xRange);
    const yScale = d3.scaleLinear(yDomain, yRange);
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(width / 80, xOpts.format ?? ',.0f')
      .tickSizeOuter(0);
    const yAxis = d3.axisLeft(yScale).ticks(height / 40, yOpts.format); // Number of ticks here
    const yFormat = yScale.tickFormat(100, yOpts.format ?? d3.format('.0%'));

    const svg = d3
      .create('svg')
      .attr('preserveAspectRatio', 'xMinYMin meet')
      // .attr('width', width)
      // .attr('height', height)
      .attr('viewBox', [0, 0, width, height])
      .attr('class', 'svg-plot w-full h-auto h-intrinsic overflow-visible');
    // .attr('style', 'max-width: 100%; height: auto; height: intrinsic;');
    // YAxis
    svg
      .append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(yAxis)
      .call((g) => g.select('.domain').remove()) // Remove axis line
      .call((g) =>
        g
          .selectAll('.tick line')
          .clone()
          .attr('x2', width - margin.left - margin.right)
          .attr('stroke-opacity', 0.1)
      ) // tick line for every step
      .call((g) =>
        g
          .append('text')
          .attr('x', -12)
          .attr('y', margin.top - textSize)
          .attr('fill', 'currentColor')
          .attr('font-size', textSize)
          .attr('text-anchor', 'start')
          .text(yOpts.label ?? '')
      );

    // Bars
    const bars = svg
      .append('g')

      .selectAll('rect')
      .data(bins)
      .join('rect')
      .attr('x', (d) => xScale(d.x0!) + inset.left)
      .attr('width', (d) => Math.max(0, xScale(d.x1!) - xScale(d.x0!) - inset.left - inset.right))
      .attr('y', (d, i) => yScale(Ybinned[i]))
      .attr('height', (d, i) => yScale(0) - yScale(Ybinned[i]))
      .attr('fill', (d) => d3.interpolateViridis((d.x0! + d.x1!) / 20))
      .attr('stroke', '#ffffff22');

    // bars.append('title').text((d, i) => [`${d.x0} ≤ x < ${d.x1}`, yFormat(Y[i])].join('\n'));

    // xAxis
    svg
      .append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(xAxis)
      .call((g) =>
        g
          .append('text')
          .attr('x', width - margin.right)
          .attr('y', margin.bottom)
          .attr('fill', 'currentColor')
          .attr('font-size', textSize)
          .attr('text-anchor', 'end')
          .text(xOpts.label ?? '')
      );

    const update = (x0: number, x1: number) => {
      $mask = $sFeatureData?.data.map((v) => v > x0 && v < x1);
      $sEvent = { type: 'maskUpdated' };
    };

    const brushended = (event: d3.D3BrushEvent<T>): [number, number] | undefined => {
      const { selection } = event;
      if (!event.sourceEvent || !selection) {
        bars.attr('fill', (d) => d3.interpolateViridis((d.x0! + d.x1!) / 20));
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        $mask = new Array($sFeatureData?.data.length).fill(true);
        $sEvent = { type: 'maskUpdated' };
        return undefined;
      }

      const [x0, x1] = selection.map(xScale.invert);
      if (x0 === null || x1 === null) return;

      bars.attr('fill', (d) =>
        d.x0! < x0 || d.x1! > x1 ? '#262626' : d3.interpolateViridis((d.x0! + d.x1!) / 20)
      );

      update(x0, x1);
      //     d3.select(this).transition().call(brush.move, x1 > x0 ? [x0, x1].map(xScale) : null);
    };

    // const f = throttle(brushended, 10);
    const brushF = d3
      .brushX()
      .extent([
        [margin.left, margin.top],
        [width - margin.right, height - margin.bottom]
      ])
      .on('start brush end', throttle(brushended, 10));

    const brush = svg.append('g').call(brushF);

    brush.selectAll().enter().attr('stroke', 'none');
    return svg;
  }

  let currData: FeatureAndGroup | undefined;
  let svg: d3.Selection<SVGSVGElement, number[], never, never>;
  $: if (
    div &&
    $sFeatureData?.dataType !== 'singular' &&
    !isEqual($sFeatureData?.name, currData) &&
    ($sEvent?.type === 'featureUpdated' ||
      $sEvent?.type === 'sampleUpdated' ||
      $sEvent?.type === 'renderComplete')
  ) {
    currData = $sFeatureData.name;
    if (svg) div.removeChild(svg.node()!);
    svg = Histogram($sFeatureData.data, { x: (x) => x });
    div.appendChild(svg.node()!);
    // updatePlot($sFeatureData.name);
  }

  // $: if (minmax) {
  //   $mask = $sFeatureData?.data.map((v) => v > minmax[0] && v < minmax[1]);
  //   $sEvent = { type: 'maskUpdated' };
  // }
</script>

<!--
<button
  class="h-4 w-4"
  on:click={() => {
    $mask = $sFeatureData?.data.map((v) => v > 2 - Math.random() && v < 4 + 2 * Math.random() - 1);
    $sEvent = { type: 'maskUpdated' };
  }}>Hi</button
> -->
<div bind:this={div} class="relative max-w-[500px] overflow-visible p-2" />
