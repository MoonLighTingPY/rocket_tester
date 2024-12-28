import { useState, useEffect, useCallback } from 'react';
import { socket } from '../websocket';

export const useDataManager = () => {
  const [testData, setTestData] = useState([]);
  const [csvData, setCsvData] = useState([]);
  const [ignitionDelay, setIgnitionDelay] = useState(null);


  const handleMessage = useCallback((event) => {
    const message = JSON.parse(event.data);

    if (message.type === 'test_data') {
      const newTestData = message.data.map(point => ({
        readingsT: point.t1 / 1e6,
        ignitionT: point.t2 / 1e6,
        l: point.l,
        p1: point.p1,
        p2: point.p2,
        tp: point.tp
      }));

      const newCsvData = message.data
        .filter(point => point.t2 > 0)
        .map(point => ({
          ignitionT: point.t2 / 1e6,
          l: point.l,
          p1: point.p1,
          p2: point.p2,
          tp: point.tp
        }));

      if (newTestData.length > 0) {
        setTestData(prev => [...prev, ...newTestData]);
      }

      if (newCsvData.length > 0) {
        setCsvData(prev => [...prev, ...newCsvData]);
      }
    }

    if (message.type === 'time_difference') {
      const delay = message.value / 1e6;
      setIgnitionDelay(delay);
    }
  }, []);

  useEffect(() => {
    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  const exportToCsv = useCallback(() => {
    const headers = ['Timestamp (s),Load (kg),Pressure1 (bar),Pressure2 (bar),Temperature (°C)'];
    const data = csvData.map(point => (
      `${point.ignitionT.toFixed(6)},${point.l},${point.p1},${point.p2},${point.tp}`
    ));

    const csvContent = headers.concat(data).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const now = new Date();
    const localDateTime = now.toLocaleString('sv-SE', { timeZoneName: 'short' })
      .replace(' ', '_')
      .replace(':', '-');

    const filename = ignitionDelay !== null
      ? `rocket_test_${localDateTime}_ignition_delay_${ignitionDelay.toFixed(6)}.csv`
      : `rocket_test_${localDateTime}.csv`;

    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }, [csvData, ignitionDelay]);

  const clearCsvData = () => setCsvData([]);
  const clearTestData = () => setTestData([]);

  return {
    testData,
    csvData,
    ignitionDelay,
    exportToCsv,
    clearCsvData,
    clearTestData
  };
};