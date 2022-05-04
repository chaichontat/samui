import Chart, {
  type ChartConfiguration,
  type ChartDataset,
  type ChartEvent
} from 'chart.js/auto/auto.js';
import { Deferrable } from '../utils';
import { defaultChartOptions } from './scatterlib';

export class MainChart extends Deferrable {
  chart?: Chart;
  dataset: ChartDataset<'scatter', { x: number; y: number }[]>;
  mounted = false;

  constructor(readonly options?: ChartConfiguration<'scatter'>) {
    super();
    this.dataset = {
      type: 'scatter',
      data: [],
      parsing: false,
      normalized: true,
      pointRadius: 1.5
    };
    this.options = options;
  }

  mount(el: HTMLCanvasElement) {
    this.chart = new Chart(el.getContext('2d')!, {
      data: {
        datasets: [this.dataset]
      },
      // @ts-ignore
      options: { ...defaultChartOptions, ...this.options }
    });
    this.mounted = true;
    this._deferred.resolve();
  }

  getHoverPoint(evt: ChartEvent) {
    if (!this.chart) {
      throw new Error('Somehow getHoverPoint called before init.');
    }
    const points = this.chart.getElementsAtEventForMode(
      evt.native!,
      'nearest',
      { intersect: true },
      true
    );
    return points;
  }

  async _updateIntensity(color: string[] | Promise<string[]> | string) {
    await this.promise;
    if (color instanceof Promise) {
      color = await color;
    }
    if (color.length !== this.dataset.data.length) {
      color = '#38bdf877';
    }
    // @ts-expect-error
    this.dataset.backgroundColor = color;
  }

  _updateBounds(coords: { x: number; y: number }[]) {
    if (!coords) {
      console.error('Undefined coords');
      return;
    }

    const min = coords
      .reduce((acc, { x, y }) => [Math.min(acc[0], x), Math.min(acc[1], y)], [Infinity, Infinity])
      .map((x) => x);
    const max = coords
      .reduce((acc, { x, y }) => [Math.max(acc[0], x), Math.max(acc[1], y)], [0, 0])
      .map((x) => x);
    const over = 0.1;
    const range = [max[0] - min[0], max[1] - min[1]];

    this.chart!.options.scales!.x!.min = min[0] - over * range[0];
    this.chart!.options.scales!.x!.max = max[0] + over * range[0];
    this.chart!.options.scales!.y!.min = min[1] - over * range[1];
    this.chart!.options.scales!.y!.max = max[1] + over * range[0];
  }

  _updateCoords(coords: { x: number; y: number }[]) {
    if (!coords) {
      console.error('Undefined coords');
      return;
    }
    // @ts-ignore
    if (coords.length !== this.chart.data.datasets[0].backgroundColor?.length) {
      this.dataset.backgroundColor = '#38bdf877';
    }

    this.dataset.data = coords;
  }

  async update({
    coords,
    color
  }: {
    coords?: { x: number; y: number }[];
    color?: `${string}`[] | string;
  }) {
    await this.promise;
    if (coords) {
      this._updateBounds(coords);
      this._updateCoords(coords);
    }
    if (color) {
      await this._updateIntensity(color);
    }

    this.chart!.update();
  }
}
