import { useState, useCallback } from 'react';
import { 
  VStack, Box, Heading, FormControl, FormLabel, Select, 
  NumberInput, NumberInputField, Button, Text, Table,
  Thead, Tbody, Tr, Th, Td, HStack, RadioGroup, Radio
} from '@chakra-ui/react';
import Papa from 'papaparse';

const AnalysisPage = () => {
  const [data, setData] = useState([]);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [settings, setSettings] = useState({
    ignitionPressureThreshold: 15.0,
    ignitionLoadThreshold: 5.0,
    startCriterion: 'pressure', // or 'load'
    endPressureThreshold: 50.0,
    endLoadThreshold: 100.0,
    endCriterion: 'pressure',
    integrationStart: 'ignition',
    integrationEnd: 'threshold',
  });
  const [ignitionDelay, setIgnitionDelay] = useState(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    const delayMatch = file.name.match(/ignition_delay_([\d.]+)\.csv$/);
    
    if (delayMatch) {
      setIgnitionDelay(parseFloat(delayMatch[1]));
    }

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      complete: (results) => setData(results.data),
    });
  };

  const calculateIgnitionDelay = useCallback((pressureThreshold, loadThreshold) => {
    const startIndex = data.findIndex(point => 
      settings.startCriterion === 'pressure' 
        ? (point['Pressure1 (bar)'] > pressureThreshold || point['Pressure2 (bar)'] > pressureThreshold)
        : point['Load (kg)'] > loadThreshold
    );
    
    if (startIndex === -1) return null;
    return data[startIndex]['Timestamp (s)'];
  }, [data, settings.startCriterion]);

  const findEngineEndTime = useCallback((threshold) => {
    const ignitionIndex = data.findIndex(point => 
      point['Timestamp (s)'] >= (ignitionDelay || 0)
    );
  
    if (ignitionIndex === -1) return null;
  
    const CONSECUTIVE_POINTS = 5;
    let consecutiveCount = 0;
    let endIndex = -1;
  
    // Find the index of the highest point in the data
    const highestPointIndex = data.reduce((maxIndex, point, index) => {
      const currentValue = settings.endCriterion === 'pressure'
        ? Math.max(point['Pressure1 (bar)'], point['Pressure2 (bar)'])
        : point['Load (kg)'];
      const maxValue = settings.endCriterion === 'pressure'
        ? Math.max(data[maxIndex]['Pressure1 (bar)'], data[maxIndex]['Pressure2 (bar)'])
        : data[maxIndex]['Load (kg)'];
      return currentValue > maxValue ? index : maxIndex;
    }, ignitionIndex);
  
    for (let i = highestPointIndex; i < data.length; i++) {
      const isBelowThreshold = settings.endCriterion === 'pressure'
        ? (data[i]['Pressure1 (bar)'] < threshold && data[i]['Pressure2 (bar)'] < threshold)
        : data[i]['Load (kg)'] < threshold;
  
      console.log(`Index: ${i}, isBelowThreshold: ${isBelowThreshold}, consecutiveCount: ${consecutiveCount}`);
  
      if (isBelowThreshold) {
        consecutiveCount++;
      } else {
        consecutiveCount = 0;
      }
  
      if (consecutiveCount >= CONSECUTIVE_POINTS) {
        endIndex = i;
        break;
      }
    }
  
    console.log(`End Index: ${endIndex}`);
    return endIndex !== -1 ? data[endIndex]['Timestamp (s)'] : null;
  }, [data, settings.endCriterion, ignitionDelay]);
  


  const calculateIntegrals = useCallback((startTime, endTime) => {
    const relevantData = data.filter(point => 
      point['Timestamp (s)'] >= startTime && 
      point['Timestamp (s)'] <= endTime
    );
  
    let pressureIntegral1 = 0;
    let pressureIntegral2 = 0;
    let loadIntegral = 0;
    let temperatureIntegral = 0;
  
    for (let i = 1; i < relevantData.length; i++) {
      const dt = relevantData[i]['Timestamp (s)'] - relevantData[i-1]['Timestamp (s)'];
      pressureIntegral1 += (relevantData[i]['Pressure1 (bar)'] * dt);
      pressureIntegral2 += (relevantData[i]['Pressure2 (bar)'] * dt);
      loadIntegral += (relevantData[i]['Load (kg)'] * dt);
      temperatureIntegral += (relevantData[i]['Temperature (°C)'] * dt);
    }
  
    const fullPressureIntegral1 = data.reduce((acc, point, i, arr) => {
      if (i === 0) return acc;
      const dt = point['Timestamp (s)'] - arr[i-1]['Timestamp (s)'];
      return acc + (point['Pressure1 (bar)'] * dt);
    }, 0);
  
    const fullPressureIntegral2 = data.reduce((acc, point, i, arr) => {
      if (i === 0) return acc;
      const dt = point['Timestamp (s)'] - arr[i-1]['Timestamp (s)'];
      return acc + (point['Pressure2 (bar)'] * dt);
    }, 0);
  
    const fullLoadIntegral = data.reduce((acc, point, i, arr) => {
      if (i === 0) return acc;
      const dt = point['Timestamp (s)'] - arr[i-1]['Timestamp (s)'];
      return acc + (point['Load (kg)'] * dt);
    }, 0);
  
    const fullTemperatureIntegral = data.reduce((acc, point, i, arr) => {
      if (i === 0) return acc;
      const dt = point['Timestamp (s)'] - arr[i-1]['Timestamp (s)'];
      return acc + (point['Temperature (°C)'] * dt);
    }, 0);
  
    const calculateStats = (values) => {
      const filteredValues = values.filter(v => v !== undefined && !isNaN(v));
      if (filteredValues.length === 0) return { min: 0, max: 0, avg: 0 };
  
      return {
        min: Math.min(...filteredValues),
        max: Math.max(...filteredValues),
        avg: filteredValues.reduce((a, b) => a + b, 0) / filteredValues.length
      };
    };
  
    const pressure1Stats = calculateStats(relevantData.map(point => point['Pressure1 (bar)']));
    const pressure2Stats = calculateStats(relevantData.map(point => point['Pressure2 (bar)']));
    const loadStats = calculateStats(relevantData.map(point => point['Load (kg)']));
    const temperatureStats = calculateStats(relevantData.map(point => point['Temperature (°C)']));
  
    return {
      duration: endTime - startTime,
      avgPressure1: pressureIntegral1 / (endTime - startTime),
      avgPressure2: pressureIntegral2 / (endTime - startTime),
      avgLoad: loadIntegral / (endTime - startTime),
      avgTemperature: temperatureIntegral / (endTime - startTime),
      partialPressureIntegral1: pressureIntegral1,
      partialPressureIntegral2: pressureIntegral2,
      partialLoadIntegral: loadIntegral,
      partialTemperatureIntegral: temperatureIntegral,
      fullPressureIntegral1,
      fullPressureIntegral2,
      fullLoadIntegral,
      fullTemperatureIntegral,
      minPressure1: pressure1Stats.min,
      maxPressure1: pressure1Stats.max,
      avgPressure1: pressure1Stats.avg,
      minPressure2: pressure2Stats.min,
      maxPressure2: pressure2Stats.max,
      avgPressure2: pressure2Stats.avg,
      minLoad: loadStats.min,
      maxLoad: loadStats.max,
      avgLoad: loadStats.avg,
      minTemperature: temperatureStats.min,
      maxTemperature: temperatureStats.max,
      avgTemperature: temperatureStats.avg
    };
  }, [data]);
  
  const runAnalysis = () => {
    if (!data.length) return;
  
    const pressureBasedDelay = calculateIgnitionDelay(
      settings.ignitionPressureThreshold,
      settings.ignitionLoadThreshold
    );
    const engineEndTime = findEngineEndTime(
      settings.endCriterion === 'pressure' ? 
        settings.endPressureThreshold : 
        settings.endLoadThreshold
    );
  
    let startTime;
    let startTimeLabel;
    switch (settings.integrationStart) {
      case 'button':
        startTime = data[0]['Timestamp (s)'];
        startTimeLabel = 'Button Press';
        break;
      case 'pressure':
        startTime = pressureBasedDelay;
        startTimeLabel = 'Pressure/Load Rise';
        break;
      case 'ignition':
        startTime = ignitionDelay;
        startTimeLabel = 'Real Ignition';
        break;
      default:
        startTime = data[0]['Timestamp (s)'];
        startTimeLabel = 'Button Press';
    }
  
    let endTime;
    switch (settings.integrationEnd) {
      case 'threshold':
        endTime = engineEndTime;
        break;
      case 'button':
        endTime = data[data.length - 1]['Timestamp (s)'];
        break;
      default:
        endTime = engineEndTime;
    }
  
    const results = calculateIntegrals(startTime, endTime);
    setAnalysisResults({
      ...results,
      pressureBasedDelay,
      engineEndTime: endTime, // Update this line to use the calculated endTime
      integrationStartPoint: startTimeLabel,
      integrationStartTime: startTime
    });
  };

  return (
    <VStack spacing={6} p={6} align="stretch">
      <Heading size="lg">Analysis Settings</Heading>

      <FormControl>
        <FormLabel>Upload Filtered Data CSV</FormLabel>
        <input type="file" accept=".csv" onChange={handleFileUpload} />
      </FormControl>

      <FormControl>
  <FormLabel>Engine Start Criterion</FormLabel>
  <RadioGroup 
    value={settings.startCriterion}
    onChange={value => setSettings(prev => ({ ...prev, startCriterion: value }))}
  >
    <HStack>
      <Radio value="pressure">Pressure</Radio>
      <Radio value="load">Load</Radio>
    </HStack>
  </RadioGroup>
</FormControl>

{settings.startCriterion === 'pressure' ? (
  <FormControl>
    <FormLabel>Start Pressure Threshold (bar)</FormLabel>
    <NumberInput 
      value={settings.ignitionPressureThreshold}
      onChange={(_, value) => setSettings(prev => ({ ...prev, ignitionPressureThreshold: value }))}
    >
      <NumberInputField />
    </NumberInput>
  </FormControl>
) : (
  <FormControl>
    <FormLabel>Start Load Threshold (kg)</FormLabel>
    <NumberInput 
      value={settings.ignitionLoadThreshold}
      onChange={(_, value) => setSettings(prev => ({ ...prev, ignitionLoadThreshold: value }))}
    >
      <NumberInputField />
    </NumberInput>
  </FormControl>
)}

      <FormControl>
        <FormLabel>Engine End Criterion</FormLabel>
        <RadioGroup 
          value={settings.endCriterion}
          onChange={value => setSettings(prev => ({ ...prev, endCriterion: value }))}
        >
          <HStack>
            <Radio value="pressure">Pressure</Radio>
            <Radio value="load">Load</Radio>
          </HStack>
        </RadioGroup>
      </FormControl>

      {settings.endCriterion === 'pressure' ? (
        <FormControl>
          <FormLabel>End Pressure Threshold (bar)</FormLabel>
          <NumberInput 
            value={settings.endPressureThreshold}
            onChange={(_, value) => setSettings(prev => ({ ...prev, endPressureThreshold: value }))}
          >
            <NumberInputField />
          </NumberInput>
        </FormControl>
      ) : (
        <FormControl>
          <FormLabel>End Load Threshold (kg)</FormLabel>
          <NumberInput 
            value={settings.endLoadThreshold}
            onChange={(_, value) => setSettings(prev => ({ ...prev, endLoadThreshold: value }))}
          >
            <NumberInputField />
          </NumberInput>
        </FormControl>
      )}

      <FormControl>
        <FormLabel>Integration Start Point</FormLabel>
        <Select 
          value={settings.integrationStart}
          onChange={e => setSettings(prev => ({ ...prev, integrationStart: e.target.value }))}
        >
          <option value="button">Ignition Button Press</option>
          <option value="pressure">Pressure/Load Rise Threshold</option>
          <option value="ignition">Real Ignition Moment</option>
        </Select>
      </FormControl>

      <FormControl>
        <FormLabel>Integration End Point</FormLabel>
        <Select 
            value={settings.integrationEnd}
            onChange={e => setSettings(prev => ({ ...prev, integrationEnd: e.target.value }))}
        >
            <option value="threshold">Pressure/Load Drop Threshold</option>
            <option value="button">End Button Press (Last Timestamp)</option>
        </Select>
        </FormControl>

      <Button colorScheme="blue" onClick={runAnalysis} isDisabled={!data.length}>
        Calculate Results
      </Button>

      {analysisResults && (
        <Box>
            <Heading size="md" mb={4}>Analysis Results</Heading>
            <Table variant="simple">
            <Thead>
                <Tr>
                <Th>Parameter</Th>
                <Th>Value</Th>
                </Tr>
            </Thead>
            <Tbody>
            <Tr>
  <Td>Integration Start Time</Td>
  <Td>{analysisResults.integrationStartTime?.toFixed(6)} s</Td>
</Tr>
<Tr>
  <Td>Integration End Time</Td>
  <Td>{analysisResults.engineEndTime?.toFixed(6)} s</Td>
</Tr>
<Tr>
  <Td>Total Duration</Td>
  <Td>{analysisResults.duration.toFixed(6)} s</Td>
</Tr>
<Tr>
  <Td>Avg Pressure 1</Td>
  <Td>{analysisResults.avgPressure1.toFixed(2)} bar</Td>
</Tr>
<Tr>
  <Td>Avg Pressure 2</Td>
  <Td>{analysisResults.avgPressure2.toFixed(2)} bar</Td>
</Tr>
<Tr>
  <Td>Avg Load</Td>
  <Td>{analysisResults.avgLoad.toFixed(2)} kg</Td>
</Tr>
<Tr>
  <Td>Avg Temperature</Td>
  <Td>{analysisResults.avgTemperature.toFixed(2)} °C</Td>
</Tr>
<Tr>
  <Td>Partial Pressure 1 Integral</Td>
  <Td>{analysisResults.partialPressureIntegral1?.toFixed(2)} bar·s</Td>
</Tr>
<Tr>
  <Td>Partial Pressure 2 Integral</Td>
  <Td>{analysisResults.partialPressureIntegral2?.toFixed(2)} bar·s</Td>
</Tr>
<Tr>
  <Td>Partial Load Integral</Td>
  <Td>{analysisResults.partialLoadIntegral?.toFixed(2)} kg·s</Td>
</Tr>
<Tr>
  <Td>Partial Temperature Integral</Td>
  <Td>{analysisResults.partialTemperatureIntegral?.toFixed(2)} °C·s</Td>
</Tr>
<Tr>
  <Td>Full Pressure 1 Integral</Td>
  <Td>{analysisResults.fullPressureIntegral1?.toFixed(2)} bar·s</Td>
</Tr>
<Tr>
  <Td>Full Pressure 2 Integral</Td>
  <Td>{analysisResults.fullPressureIntegral2?.toFixed(2)} bar·s</Td>
</Tr>
<Tr>
  <Td>Full Load Integral</Td>
  <Td>{analysisResults.fullLoadIntegral?.toFixed(2)} kg·s</Td>
</Tr>
<Tr>
  <Td>Full Temperature Integral</Td>
  <Td>{analysisResults.fullTemperatureIntegral?.toFixed(2)} °C·s</Td>
</Tr>
            </Tbody>
            </Table>
        </Box>
        )}
    </VStack>
  );
};

export default AnalysisPage;