import { useState, useEffect, useRef } from 'react';
import { socket } from '../websocket';


function processSensorData(raw) {
  const { t1: readingsTime, t2: ignitionTime } = raw;
  
  // Convert microseconds to seconds
  const readingsTimeInSeconds = readingsTime / 1e6;
  const ingitionTimeInSeconds = ignitionTime / 1e6;

  // If ignition haven't happen yet (ignitionTime is 0), calculate negative time until ignition
  const ignitionTimestamp = ignitionTime === 0 ? -readingsTimeInSeconds : ingitionTimeInSeconds;

    return {
      ...raw,
      ignitionT: ignitionTimestamp,  // Ignition timestamp (will be 0 before ignition)
      readingsT: readingsTimeInSeconds, // Reading timestamp (always counting)
    };
}

export const useDataManager = () => {
  const [testData, setTestData] = useState([]);
  const [csvData, setCsvData] = useState([]);
  const rawDataRef = useRef([]);


  useEffect(() => {
    const handleMessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'test_data') {
        // Process new data
        const newData = message.data.map(d => processSensorData(d));
        setTestData(prev => [...prev, ...newData]);
        setCsvData(prev => [...prev, ...newData]);
        rawDataRef.current = [...rawDataRef.current, ...message.data];
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, []);


  const exportToCsv = () => {
    const headers = ['Readings Timestamp (s),Ignition Timestamp (s),Load (kg),Pressure1 (bar),Pressure2 (bar),Temperature (°C)'];
  
    const data = csvData.map(point => {
      // Sort ignitionT values only, keep others untouched
      const sortedIgnitionT = [...csvData.map(d => d.ignitionT)].sort((a, b) => a - b);
      const sortedIndex = csvData.indexOf(point);
      return `${point.readingsT.toFixed(6)},${sortedIgnitionT[sortedIndex].toFixed(6)},${point.l},${point.p1},${point.p2},${point.tp}`;
    });
  
    const csvContent = headers.concat(data).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rocket_test_${new Date().toISOString()}.csv`;
    link.click();
  };
  

  const clearCsvData = () => setCsvData([]);
  const clearTestData = () => setTestData([]);

  return {
    testData,
    csvData,
    exportToCsv,
    clearCsvData,
    clearTestData
  };
};