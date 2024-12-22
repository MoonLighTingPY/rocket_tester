// src/components/Charts.jsx
import { Line } from 'react-chartjs-2';
import { useRef, useEffect, useContext } from 'react';
import DataContext from '../hooks/DataContext';
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
import { chartOptions } from './chartOptions';

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

export const PressureChart = () => {
  const { testData } = useContext(DataContext);
  const chartRef = useRef();
  
  const data = {
    datasets: [
      {
        label: 'Pressure 1',
        data: testData.map(point => ({
          x: point.readingsT,
          y: point.p1
        })),
        borderColor: 'rgb(75, 192, 192)',
        pointRadius: 0
      },
      {
        label: 'Pressure 2',
        data: testData.map(point => ({
          x: point.readingsT,
          y: point.p2
        })),
        borderColor: 'rgb(255, 99, 132)',
        pointRadius: 0
      }
    ]
  };

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.update(); // Updates the chart when testData changes
    }
  }, [testData]);

  return <Line ref={chartRef} options={chartOptions} data={data} />;
};

export const LoadCellChart = () => {
  const { testData } = useContext(DataContext);
  const chartRef = useRef();
  
  const data = {
    datasets: [{
      label: 'Load Cell',
      data: testData.map(point => ({
        x: point.readingsT,
        y: point.l
      })),
      borderColor: 'rgb(153, 102, 255)',
      pointRadius: 0
    }]
  };

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.update(); // Updates the chart when testData changes
    }
  }, [testData]);

  return <Line ref={chartRef} options={chartOptions} data={data} />;
};

export const TemperatureChart = () => {
  const { testData } = useContext(DataContext);
  const chartRef = useRef();
  
  const data = {
    datasets: [{
      label: 'Temperature',
      data: testData.map(point => ({
        x: point.readingsT,
        y: point.tp
      })),
      borderColor: 'rgb(255, 159, 64)',
      pointRadius: 0
    }]
  };

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.update(); // Updates the chart when testData changes
    }
  }, [testData]);

  return <Line ref={chartRef} options={chartOptions} data={data} />;
};

export const ChartControls = () => {
  const { testData, exportToCsv, clearCsvData, clearTestData, csvData, } = useContext(DataContext);

  return (
    <div className="charts-controls">
      <button onClick={exportToCsv} disabled={csvData.length === 0}>
      Export to CSV
    </button>
      <button onClick={clearCsvData} disabled={csvData.length === 0}>
        Clear CSV Data
      </button>
      <button onClick={clearTestData} disabled={testData.length === 0}>
        Clear Chart Data
      </button>
    </div>
  );
};