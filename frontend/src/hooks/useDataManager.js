import { useState, useEffect, useCallback } from 'react';
import { socket } from '../websocket';

export const useDataManager = () => {
  const [testData, setTestData] = useState([]);
  const [csvData, setCsvData] = useState([]);
  const [ignitionDelay, setIgnitionDelay] = useState(null);
  const [sensorConfig, setSensorConfig] = useState([]);
  const SENSOR_COUNT = 8;

  useEffect(() => {
    // Request initial config when websocket connects
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'get_config' }));
    }
    
    const handleOpen = () => {
      socket.send(JSON.stringify({ type: 'get_config' }));
    };
    
    socket.addEventListener('open', handleOpen);
    return () => socket.removeEventListener('open', handleOpen);
  }, []);


  const handleMessage = useCallback((event) => {
    // Handle binary messages
    if (event.data instanceof Blob) {
      event.data.arrayBuffer().then(buffer => {
        const view = new DataView(buffer);
        const packetSize = 4 + 4 + (4 * SENSOR_COUNT); // timestamps + sensor values
        const packetCount = buffer.byteLength / packetSize;
            
        const newTestData = [];
        const newCsvData = [];
            
        for (let i = 0; i < packetCount; i++) {
          const offset = i * packetSize;
                
          // Read timestamps
          const readingsT = view.getUint32(offset, true) / 1e6;
          const ignitionT = view.getUint32(offset + 4, true) / 1e6;
                
          // Read sensor values
          const sensorValues = {};
          let sensorOffset = offset + 8;
                
          sensorConfig.forEach((sensor, index) => {
            if (sensor.enabled) {
              sensorValues[sensor.name] = view.getFloat32(sensorOffset + (index * 4), true);
            }
          });

          const dataPoint = {
            readingsT,
            ignitionT,
            ...sensorValues
          };

          newTestData.push(dataPoint);
          if (ignitionT > 0) {
            newCsvData.push(dataPoint);
          }
        }

        if (newTestData.length > 0) {
          setTestData(prev => [...prev, ...newTestData]);
        }
        if (newCsvData.length > 0) {
          setCsvData(prev => [...prev, ...newCsvData]);
        }
      });
      return;
    }

    const message = JSON.parse(event.data);

    if (message.type === 'test_data') {

      const newTestData = message.data.map(point => ({
        readingsT: point.t1 / 1e6,
        ignitionT: point.t2 / 1e6,
        ...point
      }));

      const newCsvData = message.data
        .filter(point => point.t2 > 0)
        .map(point => ({
          ignitionT: point.t2 / 1e6,
          ...point
        }));

      if (newTestData.length > 0) {
        setTestData(prev => [...prev, ...newTestData]);
      }

      if (newCsvData.length > 0) {
        setCsvData(prev => [...prev, ...newCsvData]);
      }
    }


    if (message.type === 'sensor_config') {
      setSensorConfig(message.config);
    }


    if (message.type === 'time_difference') {
      let delay = message.value / 1e6;
      if (delay > 10) {
        delay = 0.0;
      }
      setIgnitionDelay(delay);
    }
  }, [sensorConfig]);

  useEffect(() => {
    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  const updateSensorConfig = (newConfig) => {
    setSensorConfig(newConfig);
    // Send updated config to ESP32 through WebSocket
    socket.send(JSON.stringify({ type: 'update_config', config: newConfig }));
  };

  const exportToCsv = useCallback(() => {
    // Create headers based on sensor configuration
    const headers = ['Timestamp (s)'];
    for (const sensor of sensorConfig) {
      if (sensor.enabled) { // Only include enabled sensors
        let unit = '';
        switch (sensor.type) {
        case 0: // LOAD
          unit = '(kg)';
          break;
        case 1: // PRESSURE  
          unit = '(bar)';
          break;
        case 2: // TEMPERATURE
          unit = '(°C)';
          break;
        }
        headers.push(`${sensor.name} ${unit}`);
      }
    }

    const data = csvData.map(point => {
      const values = [point.ignitionT.toFixed(6)];
      for (const sensor of sensorConfig) {
        if (sensor.enabled) { // Only include enabled sensors
          values.push(point[sensor.name]);
        }
      }
      return values.join(',');
    });
    const csvContent = [headers.join(',')].concat(data).join('\n');
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
  }, [csvData, ignitionDelay, sensorConfig]);

  const clearCsvData = () => setCsvData([]);
  const clearTestData = () => setTestData([]);

  return {
    testData,
    csvData,
    ignitionDelay,
    sensorConfig,
    exportToCsv,
    clearCsvData,
    clearTestData,
    updateSensorConfig
  };
};