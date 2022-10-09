import * as d3 from 'd3';
import colors from 'tailwindcss/colors';
import AreaChart from './areaChart';

export default class RidgelineChart {
  node: d3.Selection<HTMLElement, unknown, null, unknown>;
  xScale: d3.ScaleLinear<number, number>;
  areas: AreaChart[] = [];

  constructor(
    node: HTMLElement,

    public width: number,
    public height: number,
    public marginBottom: number,
    public xDomain: [number, number]
  ) {
    this.node = d3.select(node).attr('class', 'ridgeline');
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

  // cs is colors.
  genArea(data: number[][], cs: string[]) {
    const n = data.length;
    const h = this.height / (n + 1);
    const oldLength = this.areas.length;
    if (!oldLength) {
      this.node
        .append('g')
        .attr('class', 'splitridge')
        .append('line')
        .style('stroke', colors.neutral[400])
        .style('stroke-width', 1)
        .attr('x1', 0)
        .attr('y1', this.height)
        .attr('x2', this.width)
        .attr('y2', this.height);
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
                .node()!,
              this.width,
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
      this.areas[i].genArea(data[n - 1 - i], cs[n - 1 - i], h * 2);
    }
  }

  highlight(i?: number) {
    if (i == undefined) {
      this.areas.forEach((area) => area.highlight());
      return;
    }
    this.areas.forEach((area, j) =>
      this.areas.length - 1 - i === j ? area.highlight() : area.unhighlight()
    );
  }
}
