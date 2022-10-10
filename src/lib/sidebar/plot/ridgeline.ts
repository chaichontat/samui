import * as d3 from 'd3';
import colors from 'tailwindcss/colors';
import AreaChart from './areaChart';

export default class RidgelineChart {
  node: d3.Selection<SVGGElement, unknown, null, undefined>;
  xScale: d3.ScaleLinear<number, number>;
  areas: AreaChart[] = [];

  constructor(
    node: HTMLElement,

    public width: number,
    public height: number,
    public marginLeft: number,
    public marginBottom: number,
    public xDomain: [number, number]
  ) {
    this.node = d3.select(node).append('g').attr('class', 'ridgeline');
    this.width = width;
    this.height = height;
    this.marginLeft = marginLeft;
    this.marginBottom = marginBottom;
    this.xDomain = xDomain;
    this.xScale = d3
      .scaleLinear()
      .domain(this.xDomain)
      .range([0, width - this.marginLeft]);
  }

  genXAxis(onlyLine = true) {
    if (this.node.select('.axisX').empty()) {
      const axisX = d3.axisBottom(this.xScale).ticks(5).tickSize(5);
      this.node
        .append('g')
        .attr('class', 'axisX tabular-nums')
        .attr('opacity', 0.8)
        .attr('transform', `translate(${this.marginLeft}, ${this.height})`)
        .attr('font-weight', 400)
        .attr('stroke-width', 0.5)
        .call(axisX)
        .call((g) =>
          g
            .selectAll('.tick line')
            .attr('class', 'removethis')
            .clone()
            .attr('class', 'thinline')
            .attr('y1', -this.height)
            .attr('y2', 0)
            .attr('stroke-opacity', 0.3)
        );
      if (onlyLine) {
        this.node.selectAll('text').remove();
        this.node.selectAll('.removethis').remove();
      }
    }
  }

  // cs is colors.
  genArea(name: string, data: number[][], cs: string[], transition = false) {
    const n = data.length;
    const h = this.height / (n + 1);
    const oldLength = this.areas.length;
    if (!oldLength) {
      this.node
        .append('clipPath')
        .append('rect')
        .attr('id', 'clipper')
        .attr('width', this.width)
        .attr('height', 10)
        .attr('fill', 'transparent');

      this.node
        .append('g')
        .attr('class', 'splitridge')
        .append('line')
        .style('stroke', colors.neutral[400])
        .style('stroke-width', 1)
        .attr('x1', this.marginLeft)
        .attr('y1', this.height)
        .attr('x2', this.width)
        .attr('y2', this.height);

      // this.node
      //   .append('text')
      //   .attr('x', this.marginLeft - 10)
      //   .attr('y', this.height)
      //   .attr('fill', colors.yellow[200])
      //   .attr('text-anchor', 'end')
      //   .attr('alignment-baseline', 'middle')
      //   .attr('font-size', 10)
      //   .text(name);
    }

    if (oldLength !== n) {
      this.areas.push(
        ...Array(n - this.areas.length)
          .fill(null)
          .map((_, i) => {
            const a = new AreaChart(
              this.node
                .insert('g', '.splitridge')
                .attr('class', `ridge-${oldLength + i}`)
                .attr('transform', `translate(${this.marginLeft},0)`)
                .node()!,
              this.width - this.marginLeft,
              h,
              0,
              this.xDomain
            );

            return a;
          })
      );

      this.areas.forEach((area, i) => {
        area.node
          // .attr('transform', `translate(0, ${this.height})`)
          // .transition()
          // .duration(300)
          .attr('transform', `translate(0, ${i * h})`);
      });
    }

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < n; i++) {
      this.areas[i].genArea(data[n - 1 - i], cs[n - 1 - i], h * 2, transition);
    }

    this.node.selectAll('path').attr('clip-path', 'url(#clipper)');
  }

  highlight(i?: number) {
    if (i == undefined) {
      this.areas.forEach((area) => area.highlight());
    } else {
      this.areas.forEach((area, j) =>
        this.areas.length - 1 - i === j ? area.highlight() : area.unhighlight()
      );
    }

    if (this.areas.length > 1) {
      this.areas.at(-1)!.unhighlight(); // Always unhighlight total pop.
    }
  }
}
