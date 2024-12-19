// src/components/Charts.jsx
import { Line } from 'react-chartjs-2';
import { useDataManager } from '../hooks/useDataManager';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin
);

const chartOptions = {
  responsive: true,
  animation: false, // Disable animation for better performance
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
      }
    },
    y: {
      beginAtZero: true
    }
  }
};

export const PressureChart = () => {
  const { testData } = useDataManager();
  
  const data = {
    datasets: [
      {
        label: 'Pressure 1',
        data: testData.map(point => ({
          x: point.t / 1000000, // Convert microseconds to seconds
          y: point.p1
        })),
        borderColor: 'rgb(75, 192, 192)',
        pointRadius: 0 // Hide points for better performance
      },
      {
        label: 'Pressure 2',
        data: testData.map(point => ({
          x: point.t / 1000000,
          y: point.p2
        })),
        borderColor: 'rgb(255, 99, 132)',
        pointRadius: 0
      }
    ]
  };

  return <Line options={chartOptions} data={data} />;
};

export const LoadCellChart = () => {
  const { testData } = useDataManager();
  
  const data = {
    datasets: [{
      label: 'Load Cell',
      data: testData.map(point => ({
        x: point.t / 1000000,
        y: point.l
      })),
      borderColor: 'rgb(153, 102, 255)',
      pointRadius: 0
    }]
  };

  return <Line options={chartOptions} data={data} />;
};

export const TemperatureChart = () => {
  const { testData } = useDataManager();
  
  const data = {
    datasets: [{
      label: 'Temperature',
      data: testData.map(point => ({
        x: point.t / 1000000,
        y: point.tp
      })),
      borderColor: 'rgb(255, 159, 64)',
      pointRadius: 0
    }]
  };

  return <Line options={chartOptions} data={data} />;
};

export const ChartControls = () => {
  const { exportToCsv, clearData, isRecording } = useDataManager();
  
  return (
    <div className="charts-controls">
      <button 
        onClick={exportToCsv}
        disabled={isRecording}
      >
        Export to CSV
      </button>
      <button 
        onClick={clearData}
        disabled={isRecording}
      >
        Clear Data
      </button>
    </div>
  );
};