// src/hooks/useDataManager.js
import { useState, useEffect } from 'react';
import { socket } from '../websocket';

const processSensorData = (data, testStartTime) => {
  const SAMPLE_PERIOD = 1 / 860; // ~1.16ms per sample
  
  return {
    ...data,
    t: (data.t - (testStartTime ? testStartTime / SAMPLE_PERIOD : 0)) * SAMPLE_PERIOD // Convert counter to seconds
  };
};

// src/hooks/useDataManager.js
export const useDataManager = () => {
  const [testData, setTestData] = useState([]);
  const [testStartTime, setTestStartTime] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [csvData, setCsvData] = useState([]); // Separate state for CSV data

  useEffect(() => {
    const handleMessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'test_data') {
        setTestData(prevData => [
          ...prevData,
          ...message.data.map(data => processSensorData(data, testStartTime))
        ]);
        setCsvData(prevData => [
          ...prevData,
          ...message.data.map(data => processSensorData(data, testStartTime))
        ]);
      } else if (message.type === 'start_test') {
        setTestStartTime(Date.now());
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, [testStartTime]);

  const exportToCsv = () => {
    const headers = ['Timestamp (s),Load (kg),Pressure1 (bar),Pressure2 (bar),Temperature (°C)'];
    const data = csvData.map(point => {
      return `${point.t.toFixed(6)},${point.l},${point.p1},${point.p2},${point.tp}`;
    });

    const csvContent = headers.concat(data).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rocket_test_${new Date().toISOString()}.csv`;
    link.click();
  };

  const clearCsvData = () => {
    setCsvData([]);
  };


  return {
    testData,
    testStartTime,
    isRecording,
    setIsRecording,
    exportToCsv,
    clearCsvData,  // For clearing CSV data
  };
};