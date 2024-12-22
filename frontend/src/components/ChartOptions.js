export const chartOptions = {
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
    },
    scales: {
      x: {
        type: 'linear',
        title: {
          display: true,
          text: 'Time (s)'
        },
        ticks: {
          callback: (value) => value.toFixed(3) // Format ticks to 3 decimal places
        }
      },
      y: {
        beginAtZero: true
      }
    }
  };