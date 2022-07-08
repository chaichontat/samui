import * as d3 from 'd3';

// Copyright 2021, Observable Inc.
// Released under the ISC license.
// https://observablehq.com/@d3/color-legend

export type LegendOptions = {
  title?: string;
  tickSize?: number;
  width?: number;
  height?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  ticks?: number;
  tickFormat?: (d: number) => string;
  tickValues?: number[];
  legendAnchor?: 'start' | 'end';
};

export type Scales =
  | d3.ScaleSequential<string, never>
  | d3.ScaleThreshold<string, never>
  | d3.ScaleOrdinal<string, never>
  | d3.ScaleLinear<number, never>
  | d3.ScaleQuantize<string, never>
  | d3.ScaleQuantile<string, never>;

export function Legend<S extends Scales>(
  selection: d3.Selection<SVGSVGElement, any, any, any>,
  color: S,
  {
    title,
    tickSize = 6,
    width = 240,
    height = 44 + tickSize,
    marginTop = 18,
    marginRight = 3,
    marginBottom = 16 + tickSize,
    marginLeft = 0,
    ticks = width / 64,
    tickFormat = undefined,
    tickValues = undefined,
    legendAnchor = 'start'
  }: LegendOptions = {}
) {
  function ramp(color: (t: number) => string, n = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = n;
    canvas.height = 1;
    const context = canvas.getContext('2d')!;
    for (let i = 0; i < n; ++i) {
      context.fillStyle = color(i / (n - 1));
      context.fillRect(i, 0, 1, 1);
    }
    return canvas;
  }

  const svg = selection
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height])
    .style('overflow', 'visible')
    .style('display', 'block');

  type TickAdjust =
    | ((g: d3.Selection<SVGGElement, any, any, any>) => d3.Selection<d3.BaseType, any, any, any>)
    | (() => void);

  let tickAdjust: TickAdjust = (g) =>
    g.selectAll('.tick line').attr('y1', marginTop + marginBottom - height);

  let x: S;

  // Continuous -> d3.ScaleLinear
  if ('interpolate' in color) {
    const n = Math.min(color.domain().length, color.range().length);

    x = color
      .copy()
      .rangeRound(d3.quantize(d3.interpolate(marginLeft, width - marginRight), n)) as S;

    svg
      .append('image')
      .attr('x', marginLeft)
      .attr('y', marginTop)
      .attr('width', width - marginLeft - marginRight)
      .attr('height', height - marginTop - marginBottom)
      .attr('preserveAspectRatio', 'none')
      .attr(
        'xlink:href',
        ramp(color.copy().domain(d3.quantize(d3.interpolate(0, 1), n))).toDataURL()
      );
  }

  // Sequential -> d3.ScaleSequential
  else if ('interpolator' in color) {
    // x = Object.assign(
    //   color.copy().interpolator(d3.interpolateRound(marginLeft, width - marginRight)),
    //   {
    //     range() {
    //       return [marginLeft, width - marginRight];
    //     }
    //   }
    // )

    x = color.copy().interpolator(d3.interpolateRound(marginLeft, width - marginRight)) as S;

    svg
      .append('image')
      .attr('x', marginLeft)
      .attr('y', marginTop)
      .attr('width', width - marginLeft - marginRight)
      .attr('height', height - marginTop - marginBottom)
      .attr('preserveAspectRatio', 'none')
      .attr('xlink:href', ramp(color.interpolator()).toDataURL());

    // scaleSequentialQuantile doesn't implement ticks or tickFormat.
    if (!('ticks' in x)) {
      if (tickValues === undefined) {
        const n = Math.round(ticks + 1);
        if (n == 1) throw new Error('Cannot generate 0 ticks.');
        tickValues = d3.range(n).map((i) => d3.quantile(color.domain(), i / (n - 1)) as number);
      }
      if (typeof tickFormat !== 'function') {
        tickFormat = d3.format(tickFormat === undefined ? ',f' : tickFormat);
      }
    }
  }

  // Threshold
  else if ('invertExtent' in color) {
    const thresholds =
      'thresholds' in color
        ? color.thresholds() // scaleQuantize
        : 'quantiles' in color
        ? color.quantiles() // scaleQuantile
        : color.domain(); // scaleThreshold

    const thresholdFormat =
      tickFormat === undefined
        ? (d: string) => d
        : typeof tickFormat === 'string'
        ? d3.format(tickFormat)
        : tickFormat;

    x = d3
      .scaleLinear()
      .domain([-1, color.range().length - 1])
      .rangeRound([marginLeft, width - marginRight]);

    svg
      .append('g')
      .selectAll('rect')
      .data(color.range())
      .join('rect')
      .attr('x', (d, i) => x(i - 1))
      .attr('y', marginTop)
      .attr('width', (d, i) => x(i) - x(i - 1))
      .attr('height', height - marginTop - marginBottom)
      .attr('fill', (d) => d);

    tickValues = d3.range(thresholds.length);
    tickFormat = (i) => thresholdFormat(thresholds[i], i);
  }

  // Ordinal
  else {
    x = d3
      .scaleBand()
      .domain(color.domain())
      .rangeRound([marginLeft, width - marginRight]);

    svg
      .append('g')
      .selectAll('rect')
      .data(color.domain())
      .join('rect')
      .attr('x', x)
      .attr('y', marginTop)
      .attr('width', Math.max(0, x.bandwidth() - 1))
      .attr('height', height - marginTop - marginBottom)
      .attr('fill', color);

    tickAdjust = () => {};
  }

  svg
    .append('g')
    .attr('transform', `translate(0,${height - marginBottom})`)
    .call(
      d3
        .axisBottom(x)
        .ticks(ticks, typeof tickFormat === 'string' ? tickFormat : undefined)
        .tickFormat(typeof tickFormat === 'function' ? tickFormat : undefined)
        .tickSize(tickSize)
        .tickValues(tickValues)
    )
    .call(tickAdjust)
    .call((g) => g.select('.domain').remove())
    .call((g) =>
      g
        .append('text')
        .attr('x', legendAnchor === 'start' ? marginLeft : width - marginRight)
        .attr('y', marginTop + marginBottom - height - 6)
        .attr('fill', 'currentColor')
        .attr('text-anchor', legendAnchor === 'start' ? 'start' : 'end')
        .attr('font-weight', 'bold')
        .attr('class', 'title')
        .text(title ?? null)
    );

  return svg.node();
}

// Copyright 2021, Observable Inc.
// Released under the ISC license.
// https://observablehq.com/@d3/color-legend
// export function Swatches(
//   color,
//   {
//     columns = null,
//     format,
//     unknown: formatUnknown,
//     swatchSize = 15,
//     swatchWidth = swatchSize,
//     swatchHeight = swatchSize,
//     marginLeft = 0
//   } = {}
// ) {
//   const id = `-swatches-${Math.random().toString(16).slice(2)}`;
//   const unknown = formatUnknown == null ? undefined : color.unknown();
//   const unknowns = unknown == null || unknown === d3.scaleImplicit ? [] : [unknown];
//   const domain = color.domain().concat(unknowns);
//   if (format === undefined) format = (x) => (x === unknown ? formatUnknown : x);

//   function entity(character) {
//     return `&#${character.charCodeAt(0).toString()};`;
//   }

//   if (columns !== null)
//     return htl.html`<div style="display: flex; align-items: center; margin-left: ${+marginLeft}px; min-height: 33px; font: 10px sans-serif;">
//   <style>

// .${id}-item {
//   break-inside: avoid;
//   display: flex;
//   align-items: center;
//   padding-bottom: 1px;
// }

// .${id}-label {
//   white-space: nowrap;
//   overflow: hidden;
//   text-overflow: ellipsis;
//   max-width: calc(100% - ${+swatchWidth}px - 0.5em);
// }

// .${id}-swatch {
//   width: ${+swatchWidth}px;
//   height: ${+swatchHeight}px;
//   margin: 0 0.5em 0 0;
// }

//   </style>
//   <div style=${{ width: '100%', columns }}>${domain.map((value) => {
//       const label = `${format(value)}`;
//       return htl.html`<div class=${id}-item>
//       <div class=${id}-swatch style=${{ background: color(value) }}></div>
//       <div class=${id}-label title=${label}>${label}</div>
//     </div>`;
//     })}
//   </div>
// </div>`;

//   return htl.html`<div style="display: flex; align-items: center; min-height: 33px; margin-left: ${+marginLeft}px; font: 10px sans-serif;">
//   <style>

// .${id} {
//   display: inline-flex;
//   align-items: center;
//   margin-right: 1em;
// }

// .${id}::before {
//   content: "";
//   width: ${+swatchWidth}px;
//   height: ${+swatchHeight}px;
//   margin-right: 0.5em;
//   background: var(--color);
// }

//   </style>
//   <div>${domain.map(
//     (value) =>
//       htl.html`<span class="${id}" style="--color: ${color(value)}">${format(value)}</span>`
//   )}</div>`;
// }
