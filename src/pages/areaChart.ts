import * as d3 from 'd3';
import { density1d } from 'fast-kde';
import colors from 'tailwindcss/colors';

export default class AreaChart {
  node: d3.Selection<HTMLElement, unknown, null, unknown>;
  xScale: d3.ScaleLinear<number, number>;
  yScale: d3.ScaleLinear<number, number>;
  area: d3.Area<[number, number]>;

  constructor(
    node: HTMLElement,

    public width: number,
    public height: number,
    public marginBottom: number,
    public xDomain: [number, number]
  ) {
    this.node = d3.select(node);
    this.width = width;
    this.height = height;
    this.marginBottom = marginBottom;
    this.xDomain = xDomain;
    this.xScale = d3.scaleLinear().domain(this.xDomain).range([0, width]);
    this.yScale = d3
      .scaleLinear()
      .domain([0, 1.2])
      .range([0, this.height * 1.5])
      .clamp(true);
    this.area = d3
      .area()
      .x((d) => this.xScale(d.x))
      .y0(this.height - this.yScale(0))
      .y1((d) => this.height - this.yScale(d.y));
  }

  genXAxis() {
    const axisX = d3.axisBottom(this.xScale);
    const g = this.node
      .append('g')
      .attr('class', 'axisX')
      .attr('transform', `translate(0, ${this.height})`)
      .attr('stroke', colors.neutral[700])
      .call(axisX);

    g.selectAll('.tick').remove();
  }

  genArea(data: number[], color?: string, height?: number) {
    if (!data?.length) {
      this.node.select('#area').select('path').attr('d', '');
      return;
    }

    const kde: Iterable<{ x: number; y: number }> = density1d(data, { bins: 256, pad: 3 });
    const changeHeight = height !== undefined && height !== this.height;
    if (changeHeight) {
      this.height = height ?? this.height;
      this.yScale = d3
        .scaleLinear()
        .domain([0, 1.2])
        .range([0, this.height * 1.5])
        .clamp(true);

      this.area = d3
        .area()
        .x((d) => this.xScale(d.x))
        .y0(this.height - this.yScale(0))
        .y1((d) => this.height - this.yScale(d.y));
    }
    // For dynamic yScale.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    // const extent = d3.extent(kde, (d) => d.x);
    // const yy = d3.map(kde, (d) => d.y);

    let node = this.node.select('#area').select('path');
    const emptyNode = node.empty();
    if (emptyNode) {
      node = this.node
        .append('g')
        .attr('id', 'area')
        .append('path')
        .attr('fill', color ?? node.attr('fill') ?? 'black')
        .attr('stroke', colors.neutral[800])
        .attr('stroke-width', 1)
        .attr('fill-opacity', 0.9);
    }

    node
      .datum(kde)
      // .transition()
      // .duration(50)
      .attr('d', this.area);

    if (changeHeight || emptyNode) {
      this.genXAxis(); // To be on top.
    }
  }
}
