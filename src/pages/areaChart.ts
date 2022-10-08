import * as d3 from 'd3';
import { density1d } from 'fast-kde';
import colors from 'tailwindcss/colors';

export default class AreaChart {
  node: d3.Selection<HTMLElement, unknown, null, unknown>;
  xScale: d3.ScaleLinear<number, number>;

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
  }

  genXAxis() {
    const axisX = d3.axisBottom(this.xScale);
    this.node
      .append('g')
      .attr('id', 'axisX')
      .attr('transform', `translate(0, ${this.height})`)
      .call(axisX);
  }

  genArea(data: number[], color?: string, height?: number) {
    this.height = height ?? this.height;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const kde: Iterable<{ x: number; y: number }> = density1d(data, { bins: 256, pad: 3 });
    // const extent = d3.extent(kde, (d) => d.x);

    const yy = d3.map(kde, (d) => d.y);
    const yScale = d3
      .scaleLinear()
      .domain([0, Math.max(...yy)])
      .range([0, this.height]);

    const area = d3
      .area()
      .x((d) => this.xScale(d.x))
      .y0(this.height - yScale(0))
      .y1((d) => this.height - yScale(d.y));

    let node = this.node.select('#area').select('path');
    if (node.empty()) {
      node = this.node.append('g').attr('id', 'area').append('path');
    }

    node
      .datum(kde)
      // .attr('stroke', '#69b3a2')
      .attr('fill', color ?? node.attr('fill') ?? 'black')
      .attr('stroke', colors.neutral[800])
      .attr('stroke-width', 1.5)
      .attr('fill-opacity', 1)
      .transition()
      .duration(500)
      .attr('d', area);
  }
}
