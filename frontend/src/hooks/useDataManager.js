// src/hooks/useDataManager.js
import { useState, useEffect } from 'react';
import { socket } from '../websocket';

export const useDataManager = () => {
  const [testData, setTestData] = useState([]);
  const [testStartTime, setTestStartTime] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    const handleMessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'test_data') {
        setTestData(prevData => [...prevData, ...message.data]);
      } else if (message.type === 'start_test') {
        setTestStartTime(Date.now());
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, []);

  const exportToCsv = () => {
    const headers = ['Timestamp (s),Load (kg),Pressure1 (bar),Pressure2 (bar),Temperature (°C)'];
    const csvData = testData.map(point => {
      const timestamp = (point.t / 1000000).toFixed(6); // Convert microseconds to seconds
      return `${timestamp},${point.l},${point.p1},${point.p2},${point.tp}`;
    });

    const csvContent = headers.concat(csvData).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rocket_test_${new Date().toISOString()}.csv`;
    link.click();
  };

  const clearData = () => {
    setTestData([]);
    setTestStartTime(null);
  };

  return {
    testData,
    testStartTime,
    isRecording,
    setIsRecording,
    exportToCsv,
    clearData
  };
};

