import * as d3 from 'd3';
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

  genArea(data: number[][], colors: string[]) {
    const n = data.length;
    const h = this.height / (n + 1);

    if (this.areas.length !== n) {
      this.areas.push(
        ...Array(n - this.areas.length)
          .fill(null)
          .map(
            (_, i) =>
              new AreaChart(
                this.node
                  .append('g')
                  .attr('id', `ridge-${i}`)
                  .attr('transform', `translate(0, ${this.height})`)
                  .node()!,
                this.width,
                h,
                0,
                this.xDomain
              )
          )
      );

      this.areas.forEach((area, i) => {
        area.node
          .transition()
          .duration(300)
          .attr('transform', `translate(0, ${i * h})`);
      });
    }

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < n; i++) {
      this.areas[i].genArea(data[i], colors[i], h * 2);
    }
  }
}
