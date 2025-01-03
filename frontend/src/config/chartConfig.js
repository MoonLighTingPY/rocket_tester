import annotationPlugin from 'chartjs-plugin-annotation';
import { Chart as ChartJS } from 'chart.js';

export const chartTheme = {
  colors: {
    loadCell: ['#36A2EB', '#FFCE56' ],           // For Load Cell sensors

    pressure: [ '#33AA21', '#4BC0C0', '#9966FF'], // For multiple Pressure sensors
    temperature: ['#FF9F40', '#C9CBCF', '#FF6384'], // For multiple Temperature sensors
  },
  annotations: {
    ignitionLine: {
      borderColor: 'red',
      borderWidth: 2,
      label: {
        content: 'Ignition',
        enabled: true,
        position: 'start',
      },
    },
  },
};

export const chartOptions = (title, ignitionDelay) => ({
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
      annotations: ignitionDelay !== null ? {
        line1: {
          type: 'line',
          xMin: ignitionDelay,
          xMax: ignitionDelay,
          borderColor: chartTheme.annotations.ignitionLine.borderColor,
          borderWidth: chartTheme.annotations.ignitionLine.borderWidth,
          label: {
            content: chartTheme.annotations.ignitionLine.label.content,
            enabled: chartTheme.annotations.ignitionLine.label.enabled,
            position: chartTheme.annotations.ignitionLine.label.position,
          },
        },
      } : {},
    },
    title: {
      display: !!title,
      text: title,
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
});

ChartJS.register(annotationPlugin);