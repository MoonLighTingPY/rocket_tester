// src/hooks/useDataManager.js
import { useState, useEffect } from 'react';
import { socket } from '../websocket';

const processSensorData = (data, testStartTime, engineTimeOffset) => {
  const SAMPLE_PERIOD = 1 / 860; // ~1.16ms per sample
  
  // Calculate the base timestamp in seconds
  const timestampInSeconds = data.t * SAMPLE_PERIOD;
  
  if (!testStartTime) {
    // Before ignition, just return the original timestamp
    return {
      ...data,
      t: timestampInSeconds,
      originalTimestamp: data.t // Store original for later reprocessing
    };
  }

  // Calculate time relative to ignition point
  let adjustedTime = (data.t - testStartTime) * SAMPLE_PERIOD;
  
  // If we have received the engine start offset, apply it
  if (engineTimeOffset) {
    // Only adjust timestamps after ignition
    if (adjustedTime >= 0) {
      // Convert engineTimeOffset from microseconds to seconds and apply
      adjustedTime -= (engineTimeOffset / 1000000);
    }
  }

  return {
    ...data,
    t: adjustedTime,
    originalTimestamp: data.t // Store original for later reprocessing
  };
};

export const useDataManager = () => {
  const [testData, setTestData] = useState([]);
  const [testStartTime, setTestStartTime] = useState(null);
  const [engineTimeOffset, setEngineTimeOffset] = useState(0);
  const [csvData, setCsvData] = useState([]);
  const [latestTimestamp, setLatestTimestamp] = useState(null);


  useEffect(() => {
    const handleMessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'test_data') {
        
        if (message.data.length > 0) {
          setLatestTimestamp(message.data[message.data.length - 1].t);
        }

        const newData = message.data.map(data => 
          processSensorData(data, testStartTime, engineTimeOffset)
        );

        setTestData(prevData => [...prevData, ...newData]);
        setCsvData(prevData => [...prevData, ...newData]);
      }
      else if (message.type === 'time_difference') {
        // Update the engine time offset and reprocess all CSV data
        setEngineTimeOffset(message.value);
        setCsvData(prevData => 
          prevData.map(data => processSensorData(
            { t: data.originalTimestamp, l: data.l, p1: data.p1, p2: data.p2, tp: data.tp }, 
            testStartTime,
            message.value
          ))
        );
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, [testStartTime, engineTimeOffset]);

  const handleStartTest = () => {
    // When Ignite is clicked, use the latest received timestamp
    setTestStartTime(latestTimestamp);
  };


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

  const clearTestData = () => {
    setTestData([]); // Clear the chart data only
  };

  return {
    testData,
    testStartTime,
    csvData,
    exportToCsv,
    clearCsvData,  // For clearing CSV data
    clearTestData,  // For clearing chart data
    handleStartTest
  };
};