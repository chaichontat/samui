import Chart, {
  type ChartConfiguration,
  type ChartDataset,
  type ChartEvent,
  type ChartOptions
} from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { MainChart } from './mainChart';
import { defaultChartOptions } from './scatterlib';

export class HoverChart extends MainChart {
  mainChart?: MainChart;
  dataset: ChartDataset<'scatter', never[]>;
  readonly externalHover?: (evt: ChartEvent) => void;
  readonly options: ChartConfiguration<'scatter'>;

  constructor({
    options,
    onHover: externalHover
  }: {
    options?: ChartConfiguration<'scatter'>;
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
    this.options = options;
    this.externalHover = externalHover;
  }

  mount(el: HTMLCanvasElement) {
    this.chart = new Chart(el.getContext('2d')!, {
      type: 'scatter',
      data: { datasets: [this.dataset] },
      // plugins: [ChartDataLabels],
      options: {
        ...defaultChartOptions,
        plugins: {
          ...defaultChartOptions.plugins
          // datalabels: {
          //   formatter: (x: { x: number; y: number }): string => ,
          //   align: 'center',
          //   anchor: 'end',
          //   offset: 2,
          //   color: '#FFFFFF',
          //   font: { size: 14 }
          // }
        },
        scales: {
          x: {
            display: false
          },
          y: { display: false, ...this.options?.scales?.y }
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
    if (this.externalHover) this.externalHover(evt);
  }

  triggerHover(coord: { x: number; y: number }, color: string) {
    if (!(this.chart && this.mainChart)) return;
    this.chart.data.datasets[0].data = [coord];
    this.chart.data.datasets[0].backgroundColor = color;
    this.chart.update();
  }
}
