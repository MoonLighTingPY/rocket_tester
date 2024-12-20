import { useState, useEffect, useRef } from 'react';
import { socket } from '../websocket';

const SAMPLE_RATE = 1 / 860; // example ~1.16ms per sample

function processSensorData(raw, testStart, offset) {
  const { t: originalT} = raw;

  // Convert raw sample index to seconds
  const timeInSeconds = originalT * SAMPLE_RATE;

  // If we haven't ignited yet, just return raw time
  if (testStart === null) {
    return {
      ...raw,
      t: timeInSeconds,
      originalTimestamp: originalT
    };
  }

  // Time relative to the ignition index
  let adjustedTime = (originalT - testStart) * SAMPLE_RATE;

  // Apply engine offset if we have it (and only for >= 0)
  if (offset && adjustedTime >= 0) {
    adjustedTime -= offset / 1e6;
  }

  return {
    ...raw,
    t: adjustedTime,
    originalTimestamp: originalT
  };
}

export const useDataManager = () => {
  const [testData, setTestData] = useState([]);
  const [testStartTime, setTestStartTime] = useState(null);
  const [engineTimeOffset, setEngineTimeOffset] = useState(0);
  const [csvData, setCsvData] = useState([]);
  const [latestTimestamp, setLatestTimestamp] = useState(null);

  // Keep all raw data so we can fully reprocess when offset changes
  const rawDataRef = useRef([]);

  useEffect(() => {
    const handleMessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'test_data') {
        if (message.data.length > 0) {
          setLatestTimestamp(message.data[message.data.length - 1].t);
        }
        // Add incoming raw data to our ref
        rawDataRef.current = [...rawDataRef.current, ...message.data];

        // Process new data
        const newData = message.data.map(d =>
          processSensorData(d, testStartTime, engineTimeOffset)
        );
        setTestData(prev => [...prev, ...newData]);
        setCsvData(prev => [...prev, ...newData]);
      } else if (message.type === 'time_difference') {
        // Update offset and reprocess everything from raw
        setEngineTimeOffset(message.value);
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, [testStartTime, engineTimeOffset]);

  // Whenever offset changes, reprocess from raw data
  useEffect(() => {
    if (rawDataRef.current.length > 0) {
      const reprocessed = rawDataRef.current.map(d =>
        processSensorData(d, testStartTime, engineTimeOffset)
      );
      setTestData(reprocessed);
      setCsvData(reprocessed);
    }
  }, [engineTimeOffset, testStartTime]);

  const handleStartTest = () => {
    // This sets ignition to the latest sample index
    setTestStartTime(latestTimestamp);
  };

  const exportToCsv = () => {
    const headers = ['Timestamp (s),Load (kg),Pressure1 (bar),Pressure2 (bar),Temperature (°C)'];
    const data = csvData.map(
      point => `${point.t.toFixed(6)},${point.l},${point.p1},${point.p2},${point.tp}`
    );
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
    handleStartTest,
    exportToCsv,
    clearCsvData,
    clearTestData
  };
};