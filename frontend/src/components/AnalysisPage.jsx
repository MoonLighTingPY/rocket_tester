import { useState, useCallback } from 'react';
import { VStack, Box, Button } from '@chakra-ui/react';
import Papa from 'papaparse';
import AnalysisControls from './AnalysisControls';
import AnalysisResults from './AnalysisResults';

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

  const saveAnalysisResults = () => {
    if (!analysisResults) return;
  
    const now = new Date();
    const localDateTime = now.toLocaleString('sv-SE', { timeZoneName: 'short' })
      .replace(' ', '_')
      .replace(':', '-');
  
    const filename = `analysis_results_${localDateTime}_` + 
      `from_${analysisResults.integrationStartPoint.replace(/\s+/g, '_')}_` +
      `to_${analysisResults.integrationEndPoint.replace(/\s+/g, '_')}_#_` +
      `ignition_delay_${ignitionDelay?.toFixed(6) ?? 'none'}.json`;
  
    const resultsBlob = new Blob([JSON.stringify(analysisResults, null, 2)], 
      { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(resultsBlob);
    link.download = filename;
    link.click();
  };

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
  
    // In the runAnalysis function, update the switch cases:
    let startTime;
let startTimeLabel;
switch (settings.integrationStart) {
  case 'button':
    startTime = data[0]['Timestamp (s)'];
    startTimeLabel = 'Button Press';
    break;
  case 'pressure':
    startTime = pressureBasedDelay;
    startTimeLabel = settings.startCriterion === 'pressure' ? 'Pressure Rise' : 'Load Rise';
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
let endTimeLabel;
switch (settings.integrationEnd) {
  case 'threshold':
    endTime = engineEndTime;
    endTimeLabel = settings.endCriterion === 'pressure' ? 'Pressure Drop' : 'Load Drop';
    break;
  case 'button':
    endTime = data[data.length - 1]['Timestamp (s)'];
    endTimeLabel = 'End Button Press';
    break;
  default:
    endTime = engineEndTime;
    endTimeLabel = settings.endCriterion === 'pressure' ? 'Pressure Drop' : 'Load Drop';
}
  

const results = calculateIntegrals(startTime, endTime);
setAnalysisResults({
  ...results,
  integrationStartPoint: startTimeLabel,    // Add this
integrationEndPoint: endTimeLabel,        // Add this
integrationStartTime: startTime,
engineEndTime: endTime,
  metadata: {
    units: {
      time: "seconds",
      pressure: "bar",
      load: "kg",
      temperature: "°C",
      pressureIntegral: "bar·s",
      loadIntegral: "kg·s",
      temperatureIntegral: "°C·s"
    },
    description: {
      avgPressure: "Average pressure during integration period",
      avgLoad: "Average load during integration period",
      avgTemperature: "Average temperature during integration period",
      partialIntegrals: "Integrals calculated only during the integration period",
      fullIntegrals: "Integrals calculated over the entire dataset",
      minMax: "Minimum and maximum values during integration period",
      delays: "Various time delay measurements",
      integrationPoints: "Start and end points of integration"
    }
  },
  measurements: {
    duration: {
      value: results.duration,
      unit: "s"
    },
    pressure: {
      avg1: { value: results.avgPressure1, unit: "bar" },
      avg2: { value: results.avgPressure2, unit: "bar" },
      min1: { value: results.minPressure1, unit: "bar" },
      max1: { value: results.maxPressure1, unit: "bar" },
      min2: { value: results.minPressure2, unit: "bar" },
      max2: { value: results.maxPressure2, unit: "bar" }
    },
    load: {
      avg: { value: results.avgLoad, unit: "kg" },
      min: { value: results.minLoad, unit: "kg" },
      max: { value: results.maxLoad, unit: "kg" }
    },
    temperature: {
      avg: { value: results.avgTemperature, unit: "°C" },
      min: { value: results.minTemperature, unit: "°C" },
      max: { value: results.maxTemperature, unit: "°C" }
    },
    integrals: {
      partial: {
        pressure1: { value: results.partialPressureIntegral1, unit: "bar·s" },
        pressure2: { value: results.partialPressureIntegral2, unit: "bar·s" },
        load: { value: results.partialLoadIntegral, unit: "kg·s" },
        temperature: { value: results.partialTemperatureIntegral, unit: "°C·s" }
      },
      full: {
        pressure1: { value: results.fullPressureIntegral1, unit: "bar·s" },
        pressure2: { value: results.fullPressureIntegral2, unit: "bar·s" },
        load: { value: results.fullLoadIntegral, unit: "kg·s" },
        temperature: { value: results.fullTemperatureIntegral, unit: "°C·s" }
      }
    },
    delays: {
      pressureBased: { value: pressureBasedDelay, unit: "s" },
      engineEnd: { value: endTime, unit: "s" },
      integrationStart: { value: startTime, unit: "s" }
    },
    integrationPoints: {
      start: startTimeLabel,
      end: endTimeLabel
    }
  }
});
  };

  return (
    <Box 
      p={[4, 6, 8]} 
      maxW="1200px" 
      mx="auto"
    >
      <VStack spacing={8} align="stretch">
        <AnalysisControls
          settings={settings}
          setSettings={setSettings}
          handleFileUpload={handleFileUpload}
          runAnalysis={runAnalysis}
          data={data}
        />
        <Box
          bg="white"
          shadow="lg"
          rounded="xl"
          p={8}
          w="full"
        >
          <AnalysisResults analysisResults={analysisResults} />
          {analysisResults && (
          <Button
            colorScheme="green"
            size="lg"
            w="full"
            mt={4}
            onClick={saveAnalysisResults}
            _hover={{ transform: 'translateY(-2px)' }}
            transition="all 0.2s"
          >
            Save Analysis Results
          </Button>
        )}
        </Box>
      </VStack>
    </Box>
  );
};

export default AnalysisPage;