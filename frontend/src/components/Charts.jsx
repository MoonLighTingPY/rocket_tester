import { Line } from 'react-chartjs-2';
import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { socket } from '../websocket';

// Register ChartJS components and plugins
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
    y: {
      beginAtZero: true
    }
  }
};

export const PressureChart = () => {
  const [data, setData] = useState({
    labels: [],
    datasets: [
      {
        label: 'Pressure 1',
        data: [],
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      },
      {
        label: 'Pressure 2',
        data: [],
        borderColor: 'rgb(255, 99, 132)',
        tension: 0.1
      }
    ]
  });

  useEffect(() => {
    const handleMessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'test_data') {
        setData(prev => ({
          labels: [...prev.labels, message.timestamp],
          datasets: [
            {
              ...prev.datasets[0],
              data: [...prev.datasets[0].data, message.pressure1]
            },
            {
              ...prev.datasets[1],
              data: [...prev.datasets[1].data, message.pressure2]
            }
          ]
        }));
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, []);

  return <Line options={chartOptions} data={data} />;
};

export const LoadCellChart = () => {
  const [data, setData] = useState({
    labels: [],
    datasets: [{
      label: 'Load Cell',
      data: [],
      borderColor: 'rgb(153, 102, 255)',
      tension: 0.1
    }]
  });

  useEffect(() => {
    const handleMessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'test_data') {
        setData(prev => ({
          labels: [...prev.labels, message.timestamp],
          datasets: [{
            ...prev.datasets[0],
            data: [...prev.datasets[0].data, message.load]
          }]
        }));
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, []);

  return <Line options={chartOptions} data={data} />;
};

export const TemperatureChart = () => {
  const [data, setData] = useState({
    labels: [],
    datasets: [{
      label: 'Temperature',
      data: [],
      borderColor: 'rgb(255, 159, 64)',
      tension: 0.1
    }]
  });

  useEffect(() => {
    const handleMessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'test_data') {
        setData(prev => ({
          labels: [...prev.labels, message.timestamp],
          datasets: [{
            ...prev.datasets[0],
            data: [...prev.datasets[0].data, message.temp]
          }]
        }));
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, []);

  return <Line options={chartOptions} data={data} />;
};