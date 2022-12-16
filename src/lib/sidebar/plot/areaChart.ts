import * as d3 from 'd3';
import { density1d } from 'fast-kde';
import colors from 'tailwindcss/colors';

export default class AreaChart {
  node: d3.Selection<HTMLElement, unknown, null, unknown>;
  xScale: d3.ScaleLinear<number, number>;
  yScale: d3.ScaleLinear<number, number>;
  area: d3.Area<{ x: number; y: number }>;
  color?: string;

  genGradient() {
    return this.node
      .append('linearGradient')
      .attr('id', 'grad')
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', this.width)
      .attr('y2', 0)
      .selectAll('stop')
      .data(d3.ticks(0, 1, 10))
      .join('stop')
      .attr('offset', (d) => d)
      .attr(
        'stop-color',
        d3.scaleSequential(this.yScale.domain(), (t) => d3.interpolateTurbo(0.05 + t * 0.95))
      );
  }

  constructor(
    node: HTMLElement,

    public width: number,
    public height: number,
    public marginBottom: number,
    public xDomain: [number, number]
  ) {
    this.node = d3.select(node).append('g').attr('class', 'area');
    this.width = width;
    this.height = height;
    this.marginBottom = marginBottom;
    this.xDomain = xDomain;
    this.xScale = d3.scaleLinear().domain(this.xDomain).range([0, width]);
    this.yScale = d3
      .scaleLinear()
      .domain([0, 1.5])
      .range([0, this.height * 1.5])
      .clamp(true);
    this.area = d3
      .area()
      .x((d) => this.xScale(d.x))
      .y0(this.height - this.yScale(0))
      .y1((d) => this.height - this.yScale(d.y)) as unknown as d3.Area<{ x: number; y: number }>;
  }

  genXAxis() {
    if (!this.node.select('.axisX').empty()) return;
    const axisX = d3.axisBottom(this.xScale);
    const g = this.node
      .append('g')
      .attr('class', 'axisX')
      .attr('transform', `translate(0, ${this.height})`)
      .attr('stroke', colors.neutral[700])
      .call(axisX);

    g.selectAll('.tick').remove();
  }

  genArea(data: number[], color?: string, height?: number, transition = false) {
    if (!data?.length) {
      this.node.select('#area').select('path').attr('d', '');
      return;
    }

    if (color) this.color = color;

    const kde: Iterable<{ x: number; y: number }> = density1d(data, { bins: 256, pad: 3 });
    const changeHeight = height !== undefined && height !== this.height;
    if (changeHeight) {
      this.height = height ?? this.height;
      this.yScale = d3
        .scaleLinear()
        .domain([0, 1])
        .range([0, this.height * 1.25])
        .clamp(true);

      // @ts-ignore
      this.area = d3
        .area()
        .x((d) => this.xScale(d.x))
        .y0(this.height - this.yScale(0))
        .y1((d) => this.height - this.yScale(d.y));

      this.node.select('.areaAxis').select('line').attr('y1', this.height).attr('y2', this.height);
    }
    // For dynamic yScale.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    // const extent = d3.extent(kde, (d) => d.x);
    // const yy = d3.map(kde, (d) => d.y);

    let node = this.node.select('.area').select('path');
    if (node.empty()) {
      this.genGradient();
      node = this.node
        .append('g')
        .attr('class', 'area')
        .append('path')
        .attr('stroke', colors.neutral[700])
        .attr('stroke-width', 1)
        .attr('fill-opacity', 0.9);

      this.node
        .append('g')
        .attr('class', 'areaAxis')
        .append('line')
        .style('stroke', colors.neutral[700])
        .style('stroke-width', 1)
        .attr('x1', 0)
        .attr('y1', this.height)
        .attr('x2', this.width)
        .attr('y2', this.height);
    }

    node = node.datum(kde).attr('fill', this.color ?? node.attr('fill') ?? 'black');
    if (transition) {
      node = node.transition().duration(400);
    }
    // .transition()
    // .duration(50)
    node.attr('d', this.area);
  }

  unhighlight() {
    this.node.select('.area').select('path').transition().attr('fill', '#fff').attr('opacity', 0.1);
  }

  highlight() {
    this.node
      .select('.area')
      .select('path')
      .transition()
      .attr('fill', this.color)
      .attr('opacity', 1);
  }
}
