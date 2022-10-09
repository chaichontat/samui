type AxisOption = {
  type?: d3.ScaleContinuousNumeric<number, number>;
  domain?: [number, number];
  range?: [number, number];
  label?: string;
  ticks?: boolean;
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

class Histogram {
  node: SVGSVGElement;
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  options: HistOptions;
  xRange: [number, number];
  yRange: [number, number];
  bars: d3.Selection<SVGRectElement, unknown, null, undefined>[] = [];

  constructor(node: SVGSVGElement, options?: Partial<HistOptions>) {
    this.node = node;
    this.options = {
      x: (d) => d, // given d in data, returns the (quantitative) x-value
      y: () => 1, // given d in data, returns the (quantitative) weight
      width: 280, // outer width of chart, in pixels
      height: 25, // outer height of chart, in pixels
      margin: { top: 0, right: 0, bottom: 0, left: 0 }, //{ top: 30, right: 30, bottom: 30, left: 40 },
      inset: { left: 0.5, right: 0.5 }, // inset left edge of bar
      xOpts: { type: d3.scaleLinear, domain: [0, 10], ticks: false },
      yOpts: { type: d3.scaleLinear, label: '', ticks: true },
      normalize: false,
      textSize: 10,
      color: colors.blue[500],
      ...options
    };

    this.xRange = [this.options.margin.left, this.options.width - this.options.margin.right];
    this.yRange = [this.options.height - this.options.margin.bottom, this.options.margin.top];
    // Compute values.

    this.svg = d3
      .select(this.node)
      .attr('preserveAspectRatio', 'xMinYMin meet')
      // .attr('width', width)
      // .attr('height', height)
      .attr('viewBox', [0, 0, this.options.width, this.options.height])
      .attr('class', 'svg-plot w-full h-intrinsic overflow-visible');
  }

  processData(data) {
    const X = d3.map(data, this.options.x);
    const Y0 = d3.map(data, this.options.y);
    const I = d3.range(X.length);

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

    if (this.options.normalize) {
      const total = d3.sum(Ybinned);
      Ybinned.forEach((y, i) => (Ybinned[i] = y / total));
    }

    // Compute default domains.
    const xDomain = this.options.xOpts?.domain ?? [bins[0].x0!, bins[bins.length - 1].x1!];
    const yDomain = this.options.yOpts?.domain ?? [0, d3.max(Ybinned)!];

    // Construct scales and axes.
    const xScale = d3.scaleLinear(xDomain, this.xRange);
    const yScale = d3.scaleLinear(yDomain, this.yRange);
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(this.options.width / 80, this.options.xOpts.format ?? ',.0f')
      .tickSizeOuter(0);
    const yAxis = d3.axisLeft(yScale).ticks(this.options.height / 40, this.options.yOpts.format); // Number of ticks here
    const yFormat = yScale.tickFormat(100, this.options.yOpts.format ?? d3.format('.0%'));

    return { bins, Ybinned, xScale, yScale, xAxis, yAxis, yFormat };
  }

  genBars(
    { bins, Ybinned, xScale, yScale, yFormat }: ReturnType<Histogram['processData']>,
    color?: string
  ) {
    const bars = this.svg
      .append('g')
      .selectAll('rect')
      .data(bins)
      .join('rect')
      .attr('x', (d) => xScale(d.x0!))
      .attr('width', (d) => Math.max(0, xScale(d.x1!) - xScale(d.x0!)))
      .attr('y', (d, i) => yScale(Ybinned[i]))
      .attr('height', (d, i) => yScale(0) - yScale(Ybinned[i]))
      .style('fill', color ?? this.options.color)
      .style('opacity', 0.7); //(d) => d3.interpolateViridis((d.x0! + d.x1!) / 20))
    // .attr('stroke', colors.neutral[500]);

    this.bars.push(bars);
    return bars;
  }

  genXAxis({ xAxis, xScale }: ReturnType<Histogram['processData']>) {
    // svg
    // .append('g')
    // .attr('transform', `translate(0,${height - margin.bottom})`)
    // .call(xAxis)
    // .call((g) => (xOpts?.ticks ? () => {} : g.selectAll('.tick').remove()))
    // .call((g) =>
    //   g
    //     .append('text')
    //     .attr('x', width - margin.right)
    //     .attr('y', margin.bottom)
    //     .attr('fill', 'currentColor')
    //     .attr('font-size', textSize)
    //     .attr('text-anchor', 'end')
    //     .text(xOpts.label ?? '')
    // )
    // .select('.domain')
    // .attr('stroke', colors.neutral[300]);

    const x = this.svg
      .append('g')
      .attr('transform', `translate(0,${this.yRange[0]})`)
      .call(xAxis)
      .call((g) => g.select('.domain').remove())
      .call((g) => g.selectAll('.tick line').attr('stroke', colors.neutral[300]))
      .call((g) => g.selectAll('.tick text').attr('fill', colors.neutral[500]));

    if (this.options.xOpts.ticks) {
      x.call((g) => g.selectAll('.tick text').attr('y', 9).attr('x', 0).attr('dy', '.35em'));
    } else {
      x.call((g) => g.selectAll('.tick').remove());
    }
    return x;
  }

  genYAxis({ yAxis, yScale }: ReturnType<Histogram['processData']>) {
    const y = this.svg
      .append('g')
      .attr('transform', `translate(${this.xRange[0]},0)`)
      .call(yAxis)
      .call((g) => g.select('.domain').remove())
      .call((g) => g.selectAll('.tick line').attr('stroke', colors.neutral[300]))
      .call((g) => g.selectAll('.tick text').attr('fill', colors.neutral[500]));

    if (this.options.yOpts.ticks) {
      y.call((g) => g.selectAll('.tick text').attr('x', -9).attr('dy', '0.35em'));
    } else {
      y.call((g) => g.selectAll('.tick text').attr('x', -9).attr('dy', '0.35em').remove());
    }
    return y;
  }

  mouseEnter(i: number) {
    console.log(this.bars, i);
    this.bars[i]?.style('opacity', 1).style('z-index', 10);
  }

  mouseLeave(i: number) {
    this.bars[i]?.style('opacity', 0.7).style('z-index', 0);
  }
}

function HistogramOld<T = number[]>(
  data: T[],
  node: SVGSVGElement,
  {
    x = (d) => d, // given d in data, returns the (quantitative) x-value
    y = () => 1, // given d in data, returns the (quantitative) weight
    width = 280, // outer width of chart, in pixels
    height = 25, // outer height of chart, in pixels
    margin = { top: 0, right: 0, bottom: 0, left: 0 }, //{ top: 30, right: 30, bottom: 30, left: 40 },
    inset = { left: 0.5, right: 0.5 }, // inset left edge of bar
    xOpts = { type: d3.scaleLinear, domain: [0, 10], ticks: false },
    yOpts = { type: d3.scaleLinear, label: '', ticks: true },
    normalize = false,
    textSize = 10,
    color = colors.blue[500]
  }: Partial<HistOptions> = {}
) {
  const xRange = [margin.left, width - margin.right];
  const yRange = [height - margin.bottom, margin.top];
  // Compute values.
  const X = d3.map(data, x);
  const Y0 = d3.map(data, y);
  const I = d3.range(X.length);

  console.log('X', X);

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
  const xAxis = d3.axisBottom(xScale);
  // .ticks(width / 80, xOpts.format ?? ',.0f')
  // .tickSizeOuter(0);
  const yAxis = d3.axisLeft(yScale).ticks(height / 40, yOpts.format); // Number of ticks here
  const yFormat = yScale.tickFormat(100, yOpts.format ?? d3.format('.0%'));

  const svg = d3
    .select(node)
    .attr('preserveAspectRatio', 'xMinYMin meet')
    // .attr('width', width)
    // .attr('height', height)
    .attr('viewBox', [0, 0, width, height])
    .attr('class', 'svg-plot w-full h-auto h-intrinsic overflow-visible');
  // .attr('style', 'max-width: 100%; height: auto; height: intrinsic;')

  // Bars
  const bars = svg
    .append('g')
    .selectAll('rect')
    .data(bins)
    .join('rect')
    .attr('x', (d) => xScale(d.x0!))
    .attr('width', (d) => Math.max(0, xScale(d.x1!) - xScale(d.x0!)))
    .attr('y', (d, i) => yScale(Ybinned[i]))
    .attr('height', (d, i) => yScale(0) - yScale(Ybinned[i]))
    .attr('fill', color)
    .attr('opacity', 0.7); //(d) => d3.interpolateViridis((d.x0! + d.x1!) / 20))
  // .attr('stroke', colors.neutral[500]);

  // xAxis
  svg
    .append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(xAxis)
    .call((g) => (xOpts?.ticks ? () => {} : g.selectAll('.tick').remove()))
    .call((g) =>
      g
        .append('text')
        .attr('x', width - margin.right)
        .attr('y', margin.bottom)
        .attr('fill', 'currentColor')
        .attr('font-size', textSize)
        .attr('text-anchor', 'end')
        .text(xOpts.label ?? '')
    )
    .select('.domain')
    .attr('stroke', colors.neutral[300]);

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
      d.x0! < x0 || d.x1! > x1 ? colors.neutral[700] : d3.interpolateViridis((d.x0! + d.x1!) / 20)
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

  brush = svg.append('g').call(brushF);
  brush.selectAll().enter().attr('stroke', 'none');
  brush.select('.selection').attr('fill', 'none');

  return svg;
}
