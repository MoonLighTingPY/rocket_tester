import { Line } from 'react-chartjs-2';
import { useRef, useEffect, useContext } from 'react';
import { HStack, Button } from '@chakra-ui/react';
import { useToast } from '@chakra-ui/toast';

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
import annotationPlugin from 'chartjs-plugin-annotation';
import { chartOptions } from './ChartOptions';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin,
  annotationPlugin
);

export const PressureChart = () => {
  const { testData, ignitionDelay } = useContext(DataContext);
  const chartRef = useRef();
  
  const data = {
    datasets: [
      {
        label: 'Pressure 1',
        data: testData.map(point => ({
          x: point.ignitionT,
          y: point.p1
        })),
        borderColor: 'rgb(75, 192, 192)',
        pointRadius: 0
      },
      {
        label: 'Pressure 2',
        data: testData.map(point => ({
          x: point.ignitionT,
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

  return <Line ref={chartRef} options={chartOptions(ignitionDelay)} data={data} />;
};

export const LoadCellChart = () => {
  const { testData, ignitionDelay } = useContext(DataContext);
  const chartRef = useRef();
  
  const data = {
    datasets: [{
      label: 'Load Cell',
      data: testData.map(point => ({
        x: ignitionDelay !== null ? point.ignitionT : point.readingsT,
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

  return <Line ref={chartRef} options={chartOptions(ignitionDelay)} data={data} />;
};

export const TemperatureChart = () => {
  const { testData, ignitionDelay } = useContext(DataContext);
  const chartRef = useRef();
  
  const data = {
    datasets: [{
      label: 'Temperature',
      data: testData.map(point => ({
        x: ignitionDelay !== null ? point.ignitionT : point.readingsT,
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

  return <Line ref={chartRef} options={chartOptions(ignitionDelay)} data={data} />;
};

export const ChartControls = () => {
  const { exportToCsv, clearCsvData, clearTestData, csvData, testData } = useContext(DataContext);
  const toast = useToast();

  const handleExport = () => {
    exportToCsv();
    toast({
      title: 'CSV Exported',
      status: 'success',
      duration: 2000,
    });
  };

  return (
    <HStack spacing={4}>
      <Button
        colorScheme="blue"
        onClick={handleExport}
        isDisabled={csvData.length === 0}
      >
        Export CSV
      </Button>
      <Button
        colorScheme="yellow"
        onClick={clearCsvData}
        isDisabled={csvData.length === 0}
      >
        Clear CSV Data
      </Button>
      <Button
        colorScheme="red"
        onClick={clearTestData}
        isDisabled={testData.length === 0}
      >
        Clear Chart Data
      </Button>
    </HStack>
  );
};