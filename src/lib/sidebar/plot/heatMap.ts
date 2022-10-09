import * as d3 from 'd3';
import { density1d } from 'fast-kde';

export default class HeatMap {
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

  static genCanvas(color: (v: number) => string, data: number[]) {
    const canvas = document.createElement('canvas');
    canvas.width = data.length;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < data.length; ++i) {
      context!.fillStyle = color(data[i]);
      context!.fillRect(i, 0, 1, 1);
    }
    return canvas;
  }

  genHeatmap(data: number[], color: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const kde: Iterable<{ x: number; y: number }> = density1d(data, { bins: 256, pad: 3 });
    const extent = d3.extent(kde, (d) => d.x);

    const yy = d3.map(kde, (d) => d.y);
    const yScale = d3
      .scaleLinear()
      .domain([0, Math.max(...yy)])
      .range([0, 1]);

    this.node
      .append('image')
      .attr('x', this.xScale(extent[0]!))
      .attr('y', 30)
      .attr('width', this.xScale(extent[1]!) - this.xScale(extent[0]!))
      .attr('height', 40)
      .attr('preserveAspectRatio', 'none')
      .attr(
        'xlink:href',
        HeatMap.genCanvas(
          d3.interpolate('transparent', color),
          yy.map((x) => yScale(x))
        ).toDataURL()
      );
  }
}
