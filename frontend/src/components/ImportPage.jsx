import { useState } from 'react';
import Papa from 'papaparse';
import { Line } from 'react-chartjs-2';
import { applyKalmanFilter, applyGaussianFilter } from '../utils/filters';
import { chartOptions } from './Charts';

const ImportPage = () => {
  const [importedData, setImportedData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [filterType, setFilterType] = useState('none');

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      complete: (results) => {
        setImportedData(results.data);
        setFilteredData(results.data);
      },
    });
  };

  const handleFilterChange = (event) => {
    const filter = event.target.value;
    setFilterType(filter);
    let data = importedData;

    if (filter === 'kalman') {
      data = applyKalmanFilter(importedData);
    } else if (filter === 'gaussian') {
      data = applyGaussianFilter(importedData);
    }

    setFilteredData(data);
  };

  const chartData = {
    datasets: [
      {
        label: 'Pressure 1',
        data: filteredData.map((point) => ({
          x: point['Readings Timestamp (s)'],
          y: point['Pressure1 (bar)'],
        })),
        borderColor: 'rgb(75, 192, 192)',
        pointRadius: 0,
      },
      {
        label: 'Pressure 2',
        data: filteredData.map((point) => ({
          x: point['Readings Timestamp (s)'],
          y: point['Pressure2 (bar)'],
        })),
        borderColor: 'rgb(255, 99, 132)',
        pointRadius: 0,
      },
    ],
  };

  return (
    <div className="import-page">
      <h1>Import CSV and Apply Filters</h1>
      <input type="file" accept=".csv" onChange={handleFileUpload} />
      <select value={filterType} onChange={handleFilterChange}>
        <option value="none">None</option>
        <option value="kalman">Kalman Filter</option>
        <option value="gaussian">Gaussian Filter</option>
      </select>
      <div className="chart">
        <Line options={chartOptions} data={chartData} />
      </div>
    </div>
  );
};

export default ImportPage;