import type { ChartConfiguration } from 'chart.js/auto';

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
    legend: { display: false },
    tooltip: { enabled: false }
  },
  resizeDelay: 50
};
