import type { ChartEvent } from 'chart.js/auto';
import { Deferrable, oneLRU } from '../utils';
import { HoverChart } from './hoverChart';
import { MainChart } from './mainChart';

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
