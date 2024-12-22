import annotationPlugin from 'chartjs-plugin-annotation';
import { Chart as ChartJS } from 'chart.js';

export const chartTheme = {
  colors: {
    pressure1: 'rgb(75, 192, 192)',
    pressure2: 'rgb(255, 99, 132)',
    loadCell: 'rgb(153, 102, 255)', 
    temperature: 'rgb(255, 159, 64)'
  },
  annotations: {
    ignitionLine: {
      borderColor: 'red',
      borderWidth: 2,
      label: {
        content: 'Ignition',
        enabled: true,
        position: 'start'
      }
    }
  }
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