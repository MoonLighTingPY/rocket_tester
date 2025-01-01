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
    integrationEnd: 'button',
  });
  const [ignitionDelay, setIgnitionDelay] = useState(null);

  const saveAnalysisResults = () => {
    if (!analysisResults) return;
  
    const now = new Date();
    const localDateTime = now.toLocaleString('sv-SE', { timeZoneName: 'short' })
      .replace(' ', '_')
      .replace(':', '-');
  
    const filename = `analysis_results_${localDateTime}_` + 
      `from_${analysisResults.partialIntegrationStartPoint.replace(/\s+/g, '_')}_` +
      `to_${analysisResults.partialIntegrationEndPoint.replace(/\s+/g, '_')}_#_` +
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
  // Find the first pair of points where threshold is crossed
  let startIndex = -1;
  for (let i = 0; i < data.length - 1; i++) {
    const current = settings.startCriterion === 'pressure'
      ? Math.max(data[i]['Pressure1 (bar)'], data[i]['Pressure2 (bar)'])
      : data[i]['Load (kg)'];
    const next = settings.startCriterion === 'pressure'
      ? Math.max(data[i + 1]['Pressure1 (bar)'], data[i + 1]['Pressure2 (bar)'])
      : data[i + 1]['Load (kg)'];
    
    const threshold = settings.startCriterion === 'pressure' ? pressureThreshold : loadThreshold;
    
    if (current <= threshold && next > threshold) {
      startIndex = i;
      break;
    }
  }
  
  if (startIndex === -1) return null;
  
  // Linear interpolation
  const p1 = settings.startCriterion === 'pressure'
    ? Math.max(data[startIndex]['Pressure1 (bar)'], data[startIndex]['Pressure2 (bar)'])
    : data[startIndex]['Load (kg)'];
  const p2 = settings.startCriterion === 'pressure'
    ? Math.max(data[startIndex + 1]['Pressure1 (bar)'], data[startIndex + 1]['Pressure2 (bar)'])
    : data[startIndex + 1]['Load (kg)'];
  const t1 = data[startIndex]['Timestamp (s)'];
  const t2 = data[startIndex + 1]['Timestamp (s)'];
  const threshold = settings.startCriterion === 'pressure' ? pressureThreshold : loadThreshold;
  
  // y = kx + b => x = (y - b) / k
  const k = (p2 - p1) / (t2 - t1);
  const b = p1 - k * t1;
  const interpolatedTime = (threshold - b) / k;
  
  return interpolatedTime;
}, [data, settings.startCriterion]);

const findEngineEndTime = useCallback((threshold) => {
  const ignitionIndex = data.findIndex(point => 
    point['Timestamp (s)'] >= (ignitionDelay || 0)
  );

  if (ignitionIndex === -1) return null;

  const CONSECUTIVE_POINTS = 5;

  const highestPointIndex = data.reduce((maxIndex, point, index) => {
    const currentValue = settings.endCriterion === 'pressure'
      ? Math.max(point['Pressure1 (bar)'], point['Pressure2 (bar)'])
      : point['Load (kg)'];
    const maxValue = settings.endCriterion === 'pressure'
      ? Math.max(data[maxIndex]['Pressure1 (bar)'], data[maxIndex]['Pressure2 (bar)'])
      : data[maxIndex]['Load (kg)'];
    return currentValue > maxValue ? index : maxIndex;
  }, ignitionIndex);

  // Find where value drops below threshold consistently
  for (let i = highestPointIndex; i < data.length - 1; i++) {
    const current = settings.endCriterion === 'pressure'
      ? Math.max(data[i]['Pressure1 (bar)'], data[i]['Pressure2 (bar)'])
      : data[i]['Load (kg)'];
    const next = settings.endCriterion === 'pressure'
      ? Math.max(data[i + 1]['Pressure1 (bar)'], data[i + 1]['Pressure2 (bar)'])
      : data[i + 1]['Load (kg)'];

    if (current >= threshold && next < threshold) {
      // Linear interpolation for end point
      const p1 = current;
      const p2 = next;
      const t1 = data[i]['Timestamp (s)'];
      const t2 = data[i + 1]['Timestamp (s)'];
      
      const k = (p2 - p1) / (t2 - t1);
      const b = p1 - k * t1;
      const interpolatedTime = (threshold - b) / k;

      // Verify the next points stay below threshold
      let allBelow = true;
      for (let j = i + 1; j < Math.min(i + 1 + CONSECUTIVE_POINTS, data.length); j++) {
        const value = settings.endCriterion === 'pressure'
          ? Math.max(data[j]['Pressure1 (bar)'], data[j]['Pressure2 (bar)'])
          : data[j]['Load (kg)'];
        if (value >= threshold) {
          allBelow = false;
          break;
        }
      }
      
      if (allBelow) {
        return interpolatedTime;
      }
    }
  }

  return null;
}, [data, settings.endCriterion, ignitionDelay]);
  const calculateIntegrals = useCallback((startTime, endTime) => {
    const relevantData = data.filter(point => 
      point['Timestamp (s)'] >= startTime && 
      point['Timestamp (s)'] <= endTime
    );
    // from first ever timestamp to the last timestamp
    const fullRelevantData = data.filter(point =>
      point['Timestamp (s)'] >= data[0]['Timestamp (s)'] &&
      point['Timestamp (s)'] <= data[data.length - 1]['Timestamp (s)']
    );

  
    const trapezoidalIntegral = (points, yKey) => {
      let integral = 0;
      for (let i = 1; i < points.length; i++) {
        const dt = points[i]['Timestamp (s)'] - points[i-1]['Timestamp (s)'];
        const y1 = points[i-1][yKey];
        const y2 = points[i][yKey];
        // S = dt * (y1 + y2) / 2
        integral += dt * (y1 + y2) / 2;
      }
      return integral;
    };
  
    const pressureIntegral1 = trapezoidalIntegral(relevantData, 'Pressure1 (bar)');
    const pressureIntegral2 = trapezoidalIntegral(relevantData, 'Pressure2 (bar)');
    const loadIntegral = trapezoidalIntegral(relevantData, 'Load (kg)');
    const temperatureIntegral = trapezoidalIntegral(relevantData, 'Temperature (°C)');
  
    const fullPressureIntegral1 = trapezoidalIntegral(fullRelevantData, 'Pressure1 (bar)');
    const fullPressureIntegral2 = trapezoidalIntegral(fullRelevantData, 'Pressure2 (bar)');
    const fullLoadIntegral = trapezoidalIntegral(fullRelevantData, 'Load (kg)');
    const fullTemperatureIntegral = trapezoidalIntegral(fullRelevantData, 'Temperature (°C)');
  

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
      partialIntegralDuration: (endTime - startTime),
      partialPressureIntegral1: pressureIntegral1,
      partialPressureIntegral2: pressureIntegral2,
      partialLoadIntegral: loadIntegral,
      partialTemperatureIntegral: temperatureIntegral,
      fullIntegralDuration: data[data.length - 1]['Timestamp (s)'] - data[0]['Timestamp (s)'],
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
      avgTemperature: temperatureStats.avg,
    };
  }, [data]);
  
  const runAnalysis = () => {
    if (!data.length) return;
  
    const thresholdBasedDelay = calculateIgnitionDelay(
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
    startTimeLabel = 'First Timestamp';
    break;
  case 'pressure':
    // Handle case where thresholdBasedDelay is null
    startTime = thresholdBasedDelay || data[0]['Timestamp (s)'];
    startTimeLabel = thresholdBasedDelay ? 
      (settings.startCriterion === 'pressure' ? 'Pressure Rise' : 'Load Rise') :
      'First Timestamp (Threshold not met)';
    break;
  case 'ignition':
    // Handle case where ignitionDelay is null
    startTime = ignitionDelay || data[0]['Timestamp (s)'];
    startTimeLabel = ignitionDelay ? 
      'Real Ignition' : 
      'First Timestamp (No ignition detected)';
    break;
  default:
    startTime = data[0]['Timestamp (s)'];
    startTimeLabel = 'First Timestamp';
}

  // Always ensure we have a valid start time
  if (startTime === null || startTime === undefined) {
    startTime = data[0]['Timestamp (s)'];
    startTimeLabel = 'First Timestamp (Fallback)';
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
    endTimeLabel = 'Last Timestamp';
    break;
  default:
    endTime = data[data.length - 1]['Timestamp (s)'];
    endTimeLabel = 'Last Timestamp';
}
  

const results = calculateIntegrals(startTime, endTime);
setAnalysisResults({
  partialIntegrationStartPoint: startTimeLabel,
  partialIntegrationEndPoint: endTimeLabel,      
  partialIntegrationStartTime: startTime,
  partialIntegrationEndTime: endTime,
  ...results,
ignitionDelay: ignitionDelay,
  metadata: {
    units: {
      time: "seconds",
      pressure: "bar",
      load: "kg",
      temperature: "°C",
      pressureIntegral: "bar·s",
      loadIntegral: "kg·s",
      temperatureIntegral: "°C·s"
    }
  },
  measurements: {
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
        duration: { value: results.partialIntegralDuration, unit: "s" },
        pressure1: { value: results.partialPressureIntegral1, unit: "bar·s" },
        pressure2: { value: results.partialPressureIntegral2, unit: "bar·s" },
        load: { value: results.partialLoadIntegral, unit: "kg·s" },
        temperature: { value: results.partialTemperatureIntegral, unit: "°C·s" }
      },
      full: {
        duration: { value: results.fullIntegralDuration, unit: "s" },
        pressure1: { value: results.fullPressureIntegral1, unit: "bar·s" },
        pressure2: { value: results.fullPressureIntegral2, unit: "bar·s" },
        load: { value: results.fullLoadIntegral, unit: "kg·s" },
        temperature: { value: results.fullTemperatureIntegral, unit: "°C·s" }
      }
    },
    delays: {
      ignitionDelay: { value: ignitionDelay, unit: "s" },
      thresholdBasedDelay: { value: thresholdBasedDelay, unit: "s" },
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