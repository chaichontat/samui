<script lang="ts">
  import { mask, sEvent, sFeatureData, sId } from '$lib/store';
  import { oneLRU } from '$src/lib/lru';
  import * as d3 from 'd3';
  import { throttle } from 'lodash-es';
  import { onMount } from 'svelte';
  let div: HTMLDivElement;

  let minmax = [0, 10];

  function Histogram<T = number[]>(
    data: T[],
    {
      domain, // convenience alias for xDomain
      label, // convenience alias for xLabel
      format, // convenience alias for xFormat
      type = d3.scaleLinear, // convenience alias for xType
      x = (d) => d, // given d in data, returns the (quantitative) x-value
      y = () => 1, // given d in data, returns the (quantitative) weight
      thresholds = 40, // approximate number of bins to generate, or threshold function
      normalize, // whether to normalize values to a total of 100%
      marginTop = 30, // top margin, in pixels
      marginRight = 30, // right margin, in pixels
      marginBottom = 30, // bottom margin, in pixels
      marginLeft = 40, // left margin, in pixels
      width = 320, // outer width of chart, in pixels
      height = 160, // outer height of chart, in pixels
      insetLeft = 0.5, // inset left edge of bar
      insetRight = 0.5, // inset right edge of bar
      xOption = { type: d3.scaleLinear },
      yOption = { type: d3.scaleLinear },
      xType = type, // type of x-scale
      xDomain = domain, // [xmin, xmax]
      xRange = [marginLeft, width - marginRight], // [left, right]
      xLabel = label, // a label for the x-axis
      xFormat = format, // a format specifier string for the x-axis
      yType = d3.scaleLinear, // type of y-scale
      yDomain, // [ymin, ymax]
      yRange = [height - marginBottom, marginTop], // [bottom, top]
      yLabel = '↑ Frequency', // a label for the y-axis
      yFormat = normalize ? '%' : undefined, // a format specifier string for the y-axis
      color = 'currentColor' // bar fill color
    } = {}
  ) {
    // Compute values.
    const X = d3.map(data, x);
    const Y0 = d3.map(data, y);
    const I = d3.range(X.length);

    // Compute bins.
    const bins = d3
      .bin()
      .thresholds(thresholds)
      .value((i) => X[i])(I);
    const Y = Array.from(bins, (I) => d3.sum(I, (i) => Y0[i]));
    if (normalize) {
      const total = d3.sum(Y);
      for (let i = 0; i < Y.length; ++i) Y[i] /= total;
    }

    // Compute default domains.
    if (xDomain === undefined) xDomain = [bins[0].x0, bins[bins.length - 1].x1];
    if (yDomain === undefined) yDomain = [0, d3.max(Y)];

    // Construct scales and axes.
    const xScale = xType(xDomain, xRange);
    const yScale = yType(yDomain, yRange);
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(width / 80, xFormat)
      .tickSizeOuter(0);
    const yAxis = d3.axisLeft(yScale).ticks(height / 80, yFormat); // Number of ticks here
    yFormat = yScale.tickFormat(100, yFormat);

    const svg = d3
      .create('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])
      .attr('class', 'svg-plot w-full h-auto h-intrinsic');
    // .attr('style', 'max-width: 100%; height: auto; height: intrinsic;');
    const margin = { top: 30, right: 30, bottom: 30, left: 40 };
    // YAxis
    svg
      .append('g')
      .attr('transform', `translate(${marginLeft},0)`)
      .call(yAxis)
      .call((g) => g.select('.domain').remove()) // Remove axis line
      .call((g) =>
        g
          .selectAll('.tick line')
          .clone()
          .attr('x2', width - marginLeft - marginRight)
          .attr('stroke-opacity', 0.1)
      ) // tick line for every step
      .call((g) =>
        g
          .append('text')
          .attr('x', -marginLeft)
          .attr('y', marginTop - 14)
          .attr('fill', 'currentColor')
          .attr('font-size', '14px')
          .attr('text-anchor', 'start')
          .text(yLabel)
      );

    // Bars
    const bars = svg
      .append('g')

      .selectAll('rect')
      .data(bins)
      .join('rect')
      .attr('x', (d) => xScale(d.x0) + insetLeft)
      .attr('width', (d) => Math.max(0, xScale(d.x1) - xScale(d.x0) - insetLeft - insetRight))
      .attr('y', (d, i) => yScale(Y[i]))
      .attr('height', (d, i) => yScale(0) - yScale(Y[i]))
      .attr('fill', (d) => d3.interpolateViridis((d.x0! + d.x1!) / 20))
      .attr('stroke', '#ffffff44');

    // bars.append('title').text((d, i) => [`${d.x0} ≤ x < ${d.x1}`, yFormat(Y[i])].join('\n'));

    // xAxis
    svg
      .append('g')
      .attr('transform', `translate(0,${height - marginBottom})`)
      .call(xAxis)
      .call((g) =>
        g
          .append('text')
          .attr('x', width - marginRight)
          .attr('y', marginBottom)
          .attr('fill', 'currentColor')
          .attr('font-size', '14px')
          .attr('text-anchor', 'end')
          .text(xLabel)
      );

    const update = (x0: number, x1: number) => {
      $mask = $sFeatureData?.data.map((v) => v > x0 && v < x1);
      $sEvent = { type: 'maskUpdated' };
    };

    const brushended = (event: d3.D3BrushEvent<T>): [number, number] | undefined => {
      const { selection } = event;
      if (!event.sourceEvent || !selection) {
        bars.attr('fill', (d) => d3.interpolateViridis((d.x0! + d.x1!) / 20));
        $mask = new Array($sFeatureData?.data.length).fill(true);
        $sEvent = { type: 'maskUpdated' };
        return undefined;
      }

      const [x0, x1] = selection.map(xScale.invert);
      if (x0 === null || x1 === null) return;

      bars.attr('fill', (d) =>
        d.x0! < x0! || d.x1! > x1! ? '#dddddd' : d3.interpolateViridis((d.x0! + d.x1!) / 20)
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

  // onMount(() => {
  //   const rand = d3.randomUniform();
  //   const data = Array.from({ length: 100 }, () => ({ x: rand() }));

  //   console.log(data);

  //   const svg = Histogram(data, { x: (d) => d.x, label: 'hi' });
  //   // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  //   div.appendChild(svg.node()!);
  // });
  let svg;
  $: if (
    div &&
    $sId.idx != undefined &&
    $sFeatureData.dataType !== 'singular' &&
    ($sEvent?.type === 'featureUpdated' || $sEvent?.type === 'sampleUpdated')
  ) {
    if (svg) div.removeChild(svg.node());
    svg = Histogram($sFeatureData.data, { x: (x) => x });
    div.appendChild(svg.node()!);
    // updatePlot($sFeatureData.name);
  }

  // $: if (minmax) {
  //   $mask = $sFeatureData?.data.map((v) => v > minmax[0] && v < minmax[1]);
  //   $sEvent = { type: 'maskUpdated' };
  // }
</script>

<button
  class="h-4 w-4"
  on:click={() => {
    $mask = $sFeatureData?.data.map((v) => v > 2 - Math.random() && v < 4 + 2 * Math.random() - 1);
    $sEvent = { type: 'maskUpdated' };
  }}>Hi</button
>
<div bind:this={div} class="relative overflow-visible p-2" />
