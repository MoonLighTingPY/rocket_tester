import annotationPlugin from 'chartjs-plugin-annotation';
import { Chart as ChartJS } from 'chart.js';

export const chartOptions = (ignitionDelay) => {
  const options = {
    responsive: true,
    animation: false,
    plugins: {
      zoom: {
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'xy',
        },
        pan: {
          enabled: true,
          mode: 'xy',
        },
      },
      legend: {
        position: 'top',
      },
      annotation: {
        annotations: {},
      },
    },
    scales: {
      x: {
        type: 'linear',
        title: {
          display: true,
          text: 'Time (s)',
        },
        ticks: {
          callback: (value) => value.toFixed(3), // Format ticks to 3 decimal places
        },
      },
      y: {
        beginAtZero: true,
      },
    },
  };

  if (ignitionDelay !== null && ignitionDelay !== 0) {
    options.plugins.annotation.annotations.line1 = {
      type: 'line',
      xMin: ignitionDelay,
      xMax: ignitionDelay,
      borderColor: 'red',
      borderWidth: 2,
      label: {
        content: 'Ignition',
        enabled: true,
        position: 'start',
      },
    };
  }

  ChartJS.register(annotationPlugin);
  return options;
};