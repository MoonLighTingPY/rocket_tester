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
    endPressureThreshold: 50.0,
    endLoadThreshold: 100.0,
    endCriterion: 'pressure', // or 'load'
    integrationStart: 'ignition', // 'button' or 'pressure'
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

  const calculateIgnitionDelay = useCallback((pressureThreshold) => {
    const startIndex = data.findIndex(point => 
      point['Pressure1 (bar)'] > pressureThreshold || 
      point['Pressure2 (bar)'] > pressureThreshold
    );
    
    if (startIndex === -1) return null;
    return data[startIndex]['Timestamp (s)'];
  }, [data]);

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
  
  for (let i = 1; i < relevantData.length; i++) {
    const dt = relevantData[i]['Timestamp (s)'] - relevantData[i-1]['Timestamp (s)'];
    pressureIntegral1 += (relevantData[i]['Pressure1 (bar)'] * dt);
    pressureIntegral2 += (relevantData[i]['Pressure2 (bar)'] * dt);
    loadIntegral += (relevantData[i]['Load (kg)'] * dt);
  }

  const duration = endTime - startTime;
  return {
    duration,
    meanPressure1: pressureIntegral1 / duration,
    meanPressure2: pressureIntegral2 / duration,
    meanLoad: loadIntegral / duration,
    totalPressureIntegral1: pressureIntegral1,
    totalPressureIntegral2: pressureIntegral2,
    totalLoadIntegral: loadIntegral
  };
}, [data]);

  const runAnalysis = () => {
    if (!data.length) return;

    const pressureBasedDelay = calculateIgnitionDelay(settings.ignitionPressureThreshold);
    const engineEndTime = findEngineEndTime(
      settings.endCriterion === 'pressure' ? 
        settings.endPressureThreshold : 
        settings.endLoadThreshold
    );

    let startTime;
    switch (settings.integrationStart) {
      case 'button':
        startTime = data[0]['Timestamp (s)'];
        break;
      case 'pressure':
        startTime = pressureBasedDelay;
        break;
      case 'ignition':
        startTime = ignitionDelay;
        break;
      default:
        startTime = data[0]['Timestamp (s)'];
    }

    const results = calculateIntegrals(startTime, engineEndTime);
    setAnalysisResults({
      ...results,
      pressureBasedDelay,
      engineEndTime
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
        <FormLabel>Ignition Pressure Threshold (bar)</FormLabel>
        <NumberInput 
          value={settings.ignitionPressureThreshold} 
          onChange={(_, value) => setSettings(prev => ({ ...prev, ignitionPressureThreshold: value }))}
        >
          <NumberInputField />
        </NumberInput>
      </FormControl>

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
          <option value="pressure">Pressure Rise by threshold</option>
          <option value="ignition">Real Ignition Moment</option>
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
                <Td>Pressure-based Ignition Delay</Td>
                <Td>{analysisResults.pressureBasedDelay?.toFixed(6)} s</Td>
              </Tr>
              <Tr>
                <Td>Engine End Time</Td>
                <Td>{analysisResults.engineEndTime?.toFixed(6)} s</Td>
              </Tr>
              <Tr>
                <Td>Total Duration</Td>
                <Td>{analysisResults.duration.toFixed(6)} s</Td>
              </Tr>
              <Tr>
                <Td>Mean Pressure 1</Td>
                <Td>{analysisResults.meanPressure1.toFixed(2)} bar</Td>
              </Tr>
              <Tr>
                <Td>Mean Pressure 2</Td>
                <Td>{analysisResults.meanPressure2.toFixed(2)} bar</Td>
              </Tr>
              <Tr>
                <Td>Mean Load</Td>
                <Td>{analysisResults.meanLoad.toFixed(2)} kg</Td>
              </Tr>
              <Tr>
                <Td>Total Pressure 1 Integral</Td>
                <Td>{analysisResults.totalPressureIntegral1.toFixed(2)} bar·s</Td>
              </Tr>
              <Tr>
                <Td>Total Pressure 2 Integral</Td>
                <Td>{analysisResults.totalPressureIntegral2.toFixed(2)} bar·s</Td>
              </Tr>
              <Tr>
                <Td>Total Load Integral</Td>
                <Td>{analysisResults.totalLoadIntegral.toFixed(2)} kg·s</Td>
              </Tr>
            </Tbody>
          </Table>
        </Box>
      )}
    </VStack>
  );
};

export default AnalysisPage;