import { useState } from 'react';
import Papa from 'papaparse';
import { Line } from 'react-chartjs-2';
import { applyKalmanFilter, applyGaussianFilter } from '../utils/filters';
import { chartOptions } from './ChartOptions';
import './ImportPage.css';

const ImportPage = () => {
  const [importedData, setImportedData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [filterType, setFilterType] = useState('none');
  const [kalmanSettings, setKalmanSettings] = useState({ Q: 0.0001, R: 0.01 });
  const [gaussianSettings, setGaussianSettings] = useState({ kernelSize: 5 });
  const [ignitionDelay, setIgnitionDelay] = useState(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    const filename = file.name;

    // Parse ignition delay from filename
    const delayMatch = filename.match(/ignition_delay_([\d.]+)\.csv$/);
    if (delayMatch) {
      setIgnitionDelay(parseFloat(delayMatch[1]));
    } else {
      setIgnitionDelay(null);
    }

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
  };

  const applyFilter = () => {
    let data = importedData;

    if (filterType === 'kalman') {
      data = applyKalmanFilter(importedData, kalmanSettings);
    } else if (filterType === 'gaussian') {
      data = applyGaussianFilter(importedData, gaussianSettings);
    }

    setFilteredData(data);
  };

  const handleKalmanSettingsChange = (event) => {
    const { name, value } = event.target;
    setKalmanSettings((prevSettings) => ({
      ...prevSettings,
      [name]: parseFloat(value),
    }));
  };

  const handleGaussianSettingsChange = (event) => {
    const { name, value } = event.target;
    setGaussianSettings((prevSettings) => ({
      ...prevSettings,
      [name]: parseInt(value, 10),
    }));
  };

  const pressureData = {
    datasets: [
      {
        label: 'Pressure 1',
        data: filteredData.map((point) => ({
          x: ignitionDelay !== null ? point['Ignition Timestamp (s)'] : point['Readings Timestamp (s)'],
          y: point['Pressure1 (bar)'],
        })),
        borderColor: 'rgb(75, 192, 192)',
        pointRadius: 0,
      },
      {
        label: 'Pressure 2',
        data: filteredData.map((point) => ({
          x: ignitionDelay !== null ? point['Ignition Timestamp (s)'] : point['Readings Timestamp (s)'],
          y: point['Pressure2 (bar)'],
        })),
        borderColor: 'rgb(255, 99, 132)',
        pointRadius: 0,
      },
    ],
  };

  const loadCellData = {
    datasets: [
      {
        label: 'Load Cell',
        data: filteredData.map((point) => ({
          x: ignitionDelay !== null ? point['Ignition Timestamp (s)'] : point['Readings Timestamp (s)'],
          y: point['Load (kg)'],
        })),
        borderColor: 'rgb(153, 102, 255)',
        pointRadius: 0,
      },
    ],
  };

  const temperatureData = {
    datasets: [
      {
        label: 'Temperature',
        data: filteredData.map((point) => ({
          x: ignitionDelay !== null ? point['Ignition Timestamp (s)'] : point['Readings Timestamp (s)'],
          y: point['Temperature (°C)'],
        })),
        borderColor: 'rgb(255, 159, 64)',
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
      {filterType === 'kalman' && (
        <div className="filter-settings">
          <label>
            Q:
            <input
              type="number"
              name="Q"
              value={kalmanSettings.Q}
              onChange={handleKalmanSettingsChange}
              step="0.0001"
            />
          </label>
          <label>
            R:
            <input
              type="number"
              name="R"
              value={kalmanSettings.R}
              onChange={handleKalmanSettingsChange}
              step="0.01"
            />
          </label>
        </div>
      )}
      {filterType === 'gaussian' && (
        <div className="filter-settings">
          <label>
            Kernel Size:
            <input
              type="number"
              name="kernelSize"
              value={gaussianSettings.kernelSize}
              onChange={handleGaussianSettingsChange}
              step="1"
              min="1"
            />
          </label>
        </div>
      )}
      {ignitionDelay !== null && (
        <div className="ignition-delay">
          <p>Ignition Delay: {ignitionDelay.toFixed(6)} seconds</p>
        </div>
      )}
      <button onClick={applyFilter}>Apply</button>
      <div className="chart">
        <h2>Pressure Sensors</h2>
        <Line options={chartOptions(ignitionDelay)} data={pressureData} />
      </div>
      <div className="chart">
        <h2>Load Cell</h2>
        <Line options={chartOptions(ignitionDelay)} data={loadCellData} />
      </div>
      <div className="chart">
        <h2>Temperature</h2>
        <Line options={chartOptions(ignitionDelay)} data={temperatureData} />
      </div>
    </div>
  );
};

export default ImportPage;