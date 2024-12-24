import { useState, useEffect, useRef } from 'react';
import { socket } from '../websocket';

function processSensorData(raw, testData) {
  const { t1: readingsTime, t2: ignitionTime } = raw;

  // Convert microseconds to seconds
  const readingsT = readingsTime / 1e6;
  const ignitionT = ignitionTime / 1e6;

  // Create the processed data point
  const processedData = {
    ...raw,
    readingsT,    // Absolute time since readings started
    ignitionT     // Absolute time since ignition (only populated after ignition)
  };

  return [...testData, processedData];
}

export const useDataManager = () => {
  const [testData, setTestData] = useState([]);
  const [csvData, setCsvData] = useState([]);
  const [ignitionDelay, setIgnitionDelay] = useState(null);
  const rawDataRef = useRef([]);

  useEffect(() => {
    const handleMessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'test_data') {
        // Process new data
        const newData = message.data.reduce((acc, d) => processSensorData(d, acc), testData);
        setTestData(newData);
        setCsvData(newData);
        rawDataRef.current = [...rawDataRef.current, ...message.data];
      }
      if (message.type === 'time_difference') {
        const delay = message.value / 1e6;
        setIgnitionDelay(delay);
        console.log(`Ignition delay: ${delay} seconds`);
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, [testData]);

  const exportToCsv = () => {
    const headers = ['Readings Timestamp (s),Ignition Timestamp (s),Load (kg),Pressure1 (bar),Pressure2 (bar),Temperature (°C)'];
  
    const data = csvData.map(point => {
      return `${point.readingsT.toFixed(6)},${point.ignitionT.toFixed(6)},${point.l},${point.p1},${point.p2},${point.tp}`;
    });
  
    const csvContent = headers.concat(data).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    // Get the current date and time in the local timezone
    const now = new Date();
    const localDateTime = now.toLocaleString('sv-SE', { timeZoneName: 'short' }).replace(' ', '_').replace(':', '-');
    
    // Include ignition delay in the filename if available
    const filename = ignitionDelay !== null 
      ? `rocket_test_${localDateTime}_ignition_delay_${ignitionDelay.toFixed(6)}.csv`
      : `rocket_test_${localDateTime}.csv`;
    
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const clearCsvData = () => setCsvData([]);
  const clearTestData = () => setTestData([]);

  return {
    testData,
    csvData,
    ignitionDelay, // Ensure ignitionDelay is returned
    exportToCsv,
    clearCsvData,
    clearTestData
  };
};