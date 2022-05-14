/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import Chart from 'chart.js/auto';

/**
 * @type {Chart<keyof import("chart.js").ChartTypeRegistry, (number | import("chart.js").ScatterDataPoint | import("chart.js").BubbleDataPoint | null)[], unknown>}
 */
let chart;
onmessage = (event) => {
  const { msg, detail, canvas, config } = event.data;
  switch (msg) {
    case 'init':
      chart = new Chart(canvas, config);
      canvas.width = 500;
      canvas.height = 500;
      chart.resize();
      break;

    case 'getHoverPoint':
      postMessage(getHoverPoint(JSON.parse(detail)));
      break;

    case 'update':
      update(detail)
        .then(() => chart.update())
        .catch(console.error);
      break;

    case 'resize':
      const { width, height } = detail;
      canvas.width = width;
      canvas.height = height;
      chart.resize();
      break;

    default:
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`Unknown message: ${msg}`);
  }
};

/**
 * @param {{ x: number; y: number }[]} coords
 */
function _updateBounds(coords) {
  if (!chart?.options?.scales?.x || !chart?.options?.scales?.y) return;
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
  chart.options.scales.x.min = min[0] - over * range[0];
  chart.options.scales.x.max = max[0] + over * range[0];
  chart.options.scales.y.min = min[1] - over * range[1];
  chart.options.scales.y.max = max[1] + over * range[0];
}

/**
 * @param {{ x: number; y: number }[]} coords
 */
function _updateCoords(coords) {
  if (!coords) {
    console.error('Undefined coords');
    return;
  }
  const data = chart.data.datasets[0];
  // @ts-ignore
  if (coords.length !== data.backgroundColor?.length) {
    data.backgroundColor = '#38bdf877';
  }

  data.data = coords;
}

/**
 * @param {string[] | Promise<string[]> | string} color
 */
async function _updateIntensity(color) {
  if (color instanceof Promise) {
    color = await color;
  }
  if (color.length !== chart.data.datasets[0].data.length) {
    color = '#38bdf877';
  }
  chart.data.datasets[0].backgroundColor = color;
}

/**
 * @param {{coords?: { x: number; y: number }[], color?: `${string}`[] | string}} data
 */
async function update({ coords, color }) {
  if (coords) {
    _updateBounds(coords);
    _updateCoords(coords);
  }
  if (color) {
    await _updateIntensity(color);
  }

  chart.update();
}

/**
 * @param {Event} evt
 */
function getHoverPoint(evt) {
  if (!chart) {
    throw new Error('Somehow getHoverPoint called before init.');
  }
  const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
  return points;
}
