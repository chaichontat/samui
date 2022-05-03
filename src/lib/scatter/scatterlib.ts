import Chart, {
  type ChartConfiguration,
  type ChartDataset,
  type ChartEvent,
  type ChartOptions
} from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Deferrable, oneLRU } from '../utils';

export const chartOptions: Readonly<ChartConfiguration<'scatter'>> = {
  animation: false,
  aspectRatio: 1,
  scales: {
    x: {
      display: false
    },
    y: {
      display: false,
      reverse: true
    }
  },
  plugins: {
    // @ts-expect-error
    legend: { display: false },
    tooltip: { enabled: false }
  },
  resizeDelay: 50
};

export class MainChart extends Deferrable {
  chart?: Chart;
  dataset: ChartDataset<'scatter', { x: number; y: number }[]>;
  mounted = false;

  constructor() {
    super();
    this.dataset = {
      type: 'scatter',
      data: [],
      parsing: false,
      normalized: true,
      pointRadius: 1.5
    };
  }

  mount(el: HTMLCanvasElement) {
    this.chart = new Chart(el.getContext('2d')!, {
      data: {
        datasets: [this.dataset]
      },
      // @ts-ignore
      options: { ...chartOptions }
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

  async _updateIntensity(color: string[] | Promise<string[]>) {
    await this.promise;
    if (color instanceof Promise) {
      color = await color;
    }
    console.assert(color.length === this.dataset.data.length);
    // @ts-expect-error
    this.dataset.backgroundColor = color;
  }

  async _updateBounds(coords: { x: number; y: number }[]) {
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
    const over = 0.05;
    const range = [max[0] - min[0], max[1] - min[1]];
    await this.promise;
    this.chart!.options.scales!.x!.min = min[0] - over * range[0];
    this.chart!.options.scales!.x!.max = max[0] + over * range[0];
    this.chart!.options.scales!.y!.min = min[1] - over * range[1];
    this.chart!.options.scales!.y!.max = max[1] + over * range[0];
  }

  async _updateCoords(coords: { x: number; y: number }[]) {
    if (!coords) {
      console.error('Undefined coords');
      return;
    }

    await this.promise;
    // @ts-ignore
    if (coords.length !== this.chart.data.datasets[0].backgroundColor?.length) {
      // @ts-expect-error
      this.dataset.backgroundColor = [];
    }

    this.dataset.data = coords;
  }

  async update({ coords, color }: { coords?: { x: number; y: number }[]; color?: `${string}`[] }) {
    await this.promise;
    if (coords) {
      await this._updateBounds(coords);
      await this._updateCoords(coords);
    }
    if (color) {
      await this._updateIntensity(color);
    }

    this.chart!.update();
  }
}

export class HoverChart extends MainChart {
  mainChart?: MainChart;
  dataset: ChartDataset<'scatter', never[]>;
  readonly externalHover: (evt: ChartEvent) => void;
  readonly options: ChartOptions<'scatter'>;

  constructor({
    options,
    onHover: externalHover
  }: {
    options?: ChartOptions<'scatter'>;
    onHover?: (evt: ChartEvent) => void;
  }) {
    super();
    this.dataset = {
      data: [],
      normalized: true,
      pointRadius: 25,
      pointHoverRadius: 25,
      borderColor: '#eeeeeedd'
    };
    this.options = options ?? {};
    this.externalHover = externalHover ?? (() => {});
  }

  mount(el: HTMLCanvasElement) {
    this.chart = new Chart(el.getContext('2d')!, {
      type: 'scatter',
      data: { datasets: [this.dataset] },
      // plugins: [ChartDataLabels],
      options: {
        ...chartOptions,
        plugins: {
          ...chartOptions.plugins
          // datalabels: {
          //   formatter: (x: { x: number; y: number }): string => ,
          //   align: 'center',
          //   anchor: 'end',
          //   offset: 2,
          //   color: '#FFFFFF',
          //   font: { size: 14 }
          // }
        },
        onHover: (evt) => this.handleHover(evt),
        ...this.options
      }
    });
    this._deferred.resolve();
    this.mounted = true;
  }

  handleHover(evt: ChartEvent) {
    if (!(this.chart && this.mainChart)) return;
    const points = this.mainChart.getHoverPoint(evt);
    if (points.length == 0) {
      this.chart.canvas.style.cursor = '';
      return;
    }

    this.chart.canvas.style.cursor = 'pointer';
    this.externalHover(evt);
  }

  triggerHover(coord: { x: number; y: number }, color: string) {
    if (!(this.chart && this.mainChart)) return;
    this.chart.data.datasets[0].data = [coord];
    this.chart.data.datasets[0].backgroundColor = color;
    this.chart.update();
  }
}

export class Charts extends Deferrable {
  readonly mainChart: MainChart;
  readonly hoverChart: HoverChart;
  readonly onHover: (idx: number) => void;
  mounted = false;
  _coords: { x: number; y: number }[] = [];
  _colors: string[] = [];

  constructor({ onHover }: { onHover?: (idx: number) => void }) {
    super();
    this.onHover = onHover ?? (() => {});
    this.mainChart = new MainChart();
    this.hoverChart = new HoverChart({ onHover: (evt) => this.handleHover(evt) });
  }

  mount(elMain: HTMLCanvasElement, elHov: HTMLCanvasElement) {
    this.mainChart.mount(elMain);
    this.hoverChart.mainChart = this.mainChart;
    this.hoverChart.mount(elHov);
    this._deferred.resolve();
    this.mounted = true;
  }

  handleHover(evt: ChartEvent) {
    if (!evt.native || !this.mounted) return;

    const points = this.mainChart.getHoverPoint(evt);
    if (points.length === 0) return;

    const idx = points[0]?.index;
    this.triggerHover(idx);
    this.onHover(idx);
  }

  triggerHover = oneLRU((idx: number) => {
    this.hoverChart.triggerHover(this.coords[idx], this.colors[idx]);
  });

  set coords(coords: { x: number; y: number }[]) {
    this.mainChart.update({ coords }).catch(console.error);
    this.hoverChart._updateBounds(coords).catch(console.error);
    this._coords = coords;
  }
  get coords() {
    return this._coords;
  }

  set colors(colors: string[]) {
    this.mainChart.update({ color: colors }).catch(console.error);
    this._colors = colors;
  }

  get colors() {
    return this._colors;
  }

  async update({ coords, color }: { coords?: { x: number; y: number }[]; color?: string[] }) {
    await this.mainChart.update({ coords, color });
    if (color) this.colors = color;
    if (coords) {
      await this.hoverChart._updateBounds(coords);
      this.coords = coords;
    }
  }
}
