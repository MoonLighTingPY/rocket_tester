import { Line } from 'react-chartjs-2';
import { useState, useEffect } from 'react';
import { Chart, registerables, CategoryScale } from 'chart.js';
import { socket } from '../websocket';
import { generateCSV } from '../csvGenerator';

// Register all necessary components, including scales
Chart.register(...registerables, CategoryScale);

const createChartData = (label, data) => ({
  labels: data.map((_, index) => index),
  datasets: [
    {
      label,
      data,
      fill: false,
      borderColor: 'rgba(75,192,192,1)',
      tension: 0.1,
    },
  ],
});

export const PressureChart = () => {
  const [pressureData1, setPressureData1] = useState([]);
  const [pressureData2, setPressureData2] = useState([]);

  useEffect(() => {
    const handleSocketMessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'pressure') {
        setPressureData1((prev) => [...prev, message.p1]);
        setPressureData2((prev) => [...prev, message.p2]);
      } else if (message.type === 'end') {
        generateCSV(pressureData1, 'pressure.csv');
      }
    };

    socket.addEventListener('message', handleSocketMessage);

    return () => {
      socket.removeEventListener('message', handleSocketMessage);
    };
  }, [pressureData1]);

  return (
    <div>
      <Line data={createChartData('Pressure Sensor 1', pressureData1)} />
      <Line data={createChartData('Pressure Sensor 2', pressureData2)} />
    </div>
  );
};

export const TemperatureChart = () => {
  const [temperatureData, setTemperatureData] = useState([]);

  useEffect(() => {
    const handleSocketMessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'temperature') {
        setTemperatureData((prev) => [...prev, message.temp]);
      } else if (message.type === 'end') {
        generateCSV(temperatureData, 'temperature.csv');
      }
    };

    socket.addEventListener('message', handleSocketMessage);

    return () => {
      socket.removeEventListener('message', handleSocketMessage);
    };
  }, [temperatureData]);

  return <Line data={createChartData('Temperature', temperatureData)} />;
};

export const ThrustChart = () => {
  const [thrustData, setThrustData] = useState([]);

  useEffect(() => {
    const handleSocketMessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'thrust') {
        setThrustData((prev) => [...prev, message.thrust]);
      } else if (message.type === 'end') {
        generateCSV(thrustData, 'thrust.csv');
      }
    };

    socket.addEventListener('message', handleSocketMessage);

    return () => {
      socket.removeEventListener('message', handleSocketMessage);
    };
  }, [thrustData]);

  return <Line data={createChartData('Thrust', thrustData)} />;
};