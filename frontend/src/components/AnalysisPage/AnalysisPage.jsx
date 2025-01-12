import { useState, useCallback } from 'react';
import { VStack, Box, Button } from '@chakra-ui/react';
import Papa from 'papaparse';
import AnalysisControls from './AnalysisControls';
import AnalysisResults from './AnalysisResults';

// Handle CSV data uploads, parse ignition delay, engine end time, and other bullshit, integrate sensor data, and prepare results for display in AnalysisResults 
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

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    const delayMatch = file.name.match(/ignition_delay_([\d.]+)\.csv$/);
    if (delayMatch) {
      setIgnitionDelay(parseFloat(delayMatch[1]));
    } else {
      setIgnitionDelay(null);
    }
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      complete: (results) => setData(results.data),
    });
  };

  // Finds the crossing time where the chosen sensor type rises above a threshold.
  const calculateIgnitionDelay = useCallback((pressureThreshold, loadThreshold) => {
    if (!data.length) return null;
    // Fallback if there aren't any recognized columns
    const hasPressure = Object.keys(data[0]).some((col) => col.includes('(bar)'));
    const hasLoad = Object.keys(data[0]).some((col) => col.includes('(kg)'));

    let startIndex = -1;
    for (let i = 0; i < data.length - 1; i++) {
      const current = settings.startCriterion === 'pressure' && hasPressure
        ? Math.max(...Object.keys(data[i])
          .filter((k) => k.includes('(bar)'))
          .map((k) => data[i][k] || 0))
        : hasLoad
          ? Math.max(...Object.keys(data[i])
            .filter((k) => k.includes('(kg)'))
            .map((k) => data[i][k] || 0))
          : 0;
      const next = settings.startCriterion === 'pressure' && hasPressure
        ? Math.max(...Object.keys(data[i + 1])
          .filter((k) => k.includes('(bar)'))
          .map((k) => data[i + 1][k] || 0))
        : hasLoad
          ? Math.max(...Object.keys(data[i + 1])
            .filter((k) => k.includes('(kg)'))
            .map((k) => data[i + 1][k] || 0))
          : 0;

      const threshold = settings.startCriterion === 'pressure' ? pressureThreshold : loadThreshold;
      if (current <= threshold && next > threshold) {
        startIndex = i;
        break;
      }
    }
    if (startIndex === -1) return null;

    // Values around the threshold crossing
    const c1 = settings.startCriterion === 'pressure' && hasPressure
      ? Math.max(...Object.keys(data[startIndex])
        .filter((k) => k.includes('(bar)'))
        .map((k) => data[startIndex][k] || 0))
      : hasLoad
        ? Math.max(...Object.keys(data[startIndex])
          .filter((k) => k.includes('(kg)'))
          .map((k) => data[startIndex][k] || 0))
        : 0;
    const c2 = settings.startCriterion === 'pressure' && hasPressure
      ? Math.max(...Object.keys(data[startIndex + 1])
        .filter((k) => k.includes('(bar)'))
        .map((k) => data[startIndex + 1][k] || 0))
      : hasLoad
        ? Math.max(...Object.keys(data[startIndex + 1])
          .filter((k) => k.includes('(kg)'))
          .map((k) => data[startIndex + 1][k] || 0))
        : 0;
    const t1 = data[startIndex]['Timestamp (s)'];
    const t2 = data[startIndex + 1]['Timestamp (s)'];
    const threshold = settings.startCriterion === 'pressure' ? pressureThreshold : loadThreshold;
    const k = (c2 - c1) / (t2 - t1);
    const b = c1 - k * t1;
    const interpolatedTime = (threshold - b) / k;
    return interpolatedTime;
  }, [data, settings.startCriterion]);

  // Finds when the chosen sensor type drops below a threshold.
  const findEngineEndTime = useCallback((threshold) => {
    if (!data.length) return null;
    if (!Object.keys(data[0]).some((col) => col.includes('(bar)') || col.includes('(kg)'))) {
      return null;
    }
    const ignitionIndex = data.findIndex((point) => point['Timestamp (s)'] >= (ignitionDelay || 0));
    if (ignitionIndex === -1) return null;

    const CONSECUTIVE_POINTS = 5;
    const headers = Object.keys(data[0]).filter((key) => key !== 'Timestamp (s)');
    const relevantHeaders = settings.endCriterion === 'pressure'
      ? headers.filter((h) => h.includes('(bar)'))
      : headers.filter((h) => h.includes('(kg)'));

    if (!relevantHeaders.length) return null;

    const getMaxValue = (point) => Math.max(...relevantHeaders.map((h) => point[h] || 0));
    const highestPointIndex = data.reduce((maxIndex, point, index) => {
      const currentValue = getMaxValue(point);
      const maxValue = getMaxValue(data[maxIndex]);
      return currentValue > maxValue ? index : maxIndex;
    }, ignitionIndex);

    for (let i = highestPointIndex; i < data.length - 1; i++) {
      const current = getMaxValue(data[i]);
      const next = getMaxValue(data[i + 1]);
      if (current >= threshold && next < threshold) {
        const p1 = current;
        const p2 = next;
        const t1 = data[i]['Timestamp (s)'];
        const t2 = data[i + 1]['Timestamp (s)'];
        const k = (p2 - p1) / (t2 - t1);
        const b = p1 - k * t1;
        const interpolatedTime = (threshold - b) / k;
        let allBelow = true;
        for (let j = i + 1; j < Math.min(i + 1 + CONSECUTIVE_POINTS, data.length); j++) {
          if (getMaxValue(data[j]) >= threshold) {
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

  // Calculates partial and full integrals and stats (min max avg) for each sensor type.

  const calculateIntegrals = useCallback((startTime, endTime) => {
    if (!data.length) return null;

    const relevantData = data.filter((point) =>
      point['Timestamp (s)'] >= startTime && point['Timestamp (s)'] <= endTime
    );
    const fullRelevantData = data.filter((point) =>
      point['Timestamp (s)'] >= data[0]['Timestamp (s)'] &&
      point['Timestamp (s)'] <= data[data.length - 1]['Timestamp (s)']
    );

    const trapezoidalIntegral = (points, yKey) => {
      let integral = 0;
      for (let i = 1; i < points.length; i++) {
        const dt = points[i]['Timestamp (s)'] - points[i - 1]['Timestamp (s)'];
        const y1 = points[i - 1][yKey] || 0;
        const y2 = points[i][yKey] || 0;
        integral += dt * (y1 + y2) / 2;
      }
      return integral;
    };

    const allHeaders = Object.keys(data[0]).filter((key) => key !== 'Timestamp (s)');
    const loadHeaders = allHeaders.filter((h) => h.toLowerCase().includes('(kg)'));
    const pressureHeaders = allHeaders.filter((h) => h.toLowerCase().includes('(bar)'));
    const temperatureHeaders = allHeaders.filter((h) => h.toLowerCase().includes('(°c)'));

    const integrals = {
      partial: {
        load: loadHeaders.map((header) => ({
          name: header,
          value: trapezoidalIntegral(relevantData, header),
        })),
        pressure: pressureHeaders.map((header) => ({
          name: header,
          value: trapezoidalIntegral(relevantData, header),
        })),
        temperature: temperatureHeaders.map((header) => ({
          name: header,
          value: trapezoidalIntegral(relevantData, header),
        })),
      },
      full: {
        load: loadHeaders.map((header) => ({
          name: header,
          value: trapezoidalIntegral(fullRelevantData, header),
        })),
        pressure: pressureHeaders.map((header) => ({
          name: header,
          value: trapezoidalIntegral(fullRelevantData, header),
        })),
        temperature: temperatureHeaders.map((header) => ({
          name: header,
          value: trapezoidalIntegral(fullRelevantData, header),
        })),
      },
    };

    const calculateStats = (values) => {
      const filteredValues = values.filter((v) => v !== undefined && !isNaN(v));
      if (!filteredValues.length) return { min: 0, max: 0, avg: 0 };
      return {
        min: Math.min(...filteredValues),
        max: Math.max(...filteredValues),
        avg: filteredValues.reduce((a, b) => a + b, 0) / filteredValues.length,
      };
    };

    const stats = {
      load: loadHeaders.map((header) => ({
        name: header,
        ...calculateStats(relevantData.map((point) => point[header])),
      })),
      pressure: pressureHeaders.map((header) => ({
        name: header,
        ...calculateStats(relevantData.map((point) => point[header])),
      })),
      temperature: temperatureHeaders.map((header) => ({
        name: header,
        ...calculateStats(relevantData.map((point) => point[header])),
      })),
    };

    return {
      partialIntegralDuration: endTime - startTime,
      fullIntegralDuration: data[data.length - 1]['Timestamp (s)'] - data[0]['Timestamp (s)'],
      integrals,
      stats,
    };
  }, [data]);

  // runAnalysis ties everything together for analysisResults, so it will, you won't fucking believe me - displays the results of the analysis.
  const runAnalysis = () => {
    if (!data.length) return;
    const thresholdBasedDelay = calculateIgnitionDelay(
      settings.ignitionPressureThreshold,
      settings.ignitionLoadThreshold
    );
    const engineEndTime = findEngineEndTime(
      settings.endCriterion === 'pressure'
        ? settings.endPressureThreshold
        : settings.endLoadThreshold
    );

    // Determine startTime
    let startTime;
    let startTimeLabel;
    switch (settings.integrationStart) {
    case 'button':
      startTime = data[0]['Timestamp (s)'];
      startTimeLabel = 'First Timestamp';
      break;
    case 'pressure':
      startTime = thresholdBasedDelay ?? data[0]['Timestamp (s)'];
      startTimeLabel = thresholdBasedDelay
        ? (settings.startCriterion === 'pressure' ? 'Pressure Rise' : 'Load Rise')
        : 'First Timestamp (Threshold not met)';
      break;
    case 'ignition':
      startTime = ignitionDelay ?? data[0]['Timestamp (s)'];
      startTimeLabel = ignitionDelay
        ? 'Real Ignition'
        : 'First Timestamp (No ignition detected)';
      break;
    default:
      startTime = data[0]['Timestamp (s)'];
      startTimeLabel = 'First Timestamp';
    }

    // Determine endTime
    let endTime;
    let endTimeLabel;
    switch (settings.integrationEnd) {
    case 'threshold':
      endTime = engineEndTime ?? data[data.length - 1]['Timestamp (s)'];
      endTimeLabel = engineEndTime
        ? (settings.endCriterion === 'pressure' ? 'Pressure Drop' : 'Load Drop')
        : 'Last Timestamp (Threshold not met)';
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
    if (!results) return;

    setAnalysisResults({
      partialIntegrationStartPoint: startTimeLabel,
      partialIntegrationEndPoint: endTimeLabel,
      partialIntegrationStartTime: `${startTime.toFixed(6)} s`,
      partialIntegrationEndTime: `${endTime.toFixed(6)} s`,
      partialIntegralDuration: `${results.partialIntegralDuration.toFixed(6)} s`,
      fullIntegralDuration: `${results.fullIntegralDuration.toFixed(6)} s`,
      ignitionDelay: ignitionDelay ? `${ignitionDelay.toFixed(6)} s` : null,
      integrals: {
        partial: {
          load: results.integrals.partial.load.map(x => ({ 
            ...x,
            value: `${x.value.toFixed(3)} kg⋅s` // Load integral in kilogram-seconds
          })),
          pressure: results.integrals.partial.pressure.map(x => ({ 
            ...x,
            value: `${x.value.toFixed(3)} bar⋅s` // Pressure integral in bar-seconds  
          })),
          temperature: results.integrals.partial.temperature.map(x => ({ 
            ...x,
            value: `${x.value.toFixed(3)} °C⋅s` // Temperature integral in celsius-seconds
          }))
        },
        full: {
          load: results.integrals.full.load.map(x => ({ 
            ...x,
            value: `${x.value.toFixed(3)} kg⋅s`
          })),
          pressure: results.integrals.full.pressure.map(x => ({ 
            ...x,
            value: `${x.value.toFixed(3)} bar⋅s`
          })),
          temperature: results.integrals.full.temperature.map(x => ({ 
            ...x,
            value: `${x.value.toFixed(3)} °C⋅s`
          }))
        }
      },
      stats: {
        load: results.stats.load.map(x => ({
          ...x,
          min: `${x.min.toFixed(3)} kg`,
          max: `${x.max.toFixed(3)} kg`,
          avg: `${x.avg.toFixed(3)} kg`
        })),
        pressure: results.stats.pressure.map(x => ({
          ...x, 
          min: `${x.min.toFixed(3)} bar`,
          max: `${x.max.toFixed(3)} bar`,
          avg: `${x.avg.toFixed(3)} bar`
        })),
        temperature: results.stats.temperature.map(x => ({
          ...x,
          min: `${x.min.toFixed(3)} °C`,
          max: `${x.max.toFixed(3)} °C`, 
          avg: `${x.avg.toFixed(3)} °C`
        }))
      }
    });
  };

  const saveAnalysisResults = () => {
    if (!analysisResults) return;
    const now = new Date();
    const localDateTime = now.toLocaleString('sv-SE', { timeZoneName: 'short' })
      .replace(' ', '_')
      .replace(':', '-');
    const filename = `analysis_results_${localDateTime}_from_${analysisResults.partialIntegrationStartPoint
      .replace(/\s+/g, '_')}_
      to_${analysisResults.partialIntegrationEndPoint.replace(/\s+/g, '_')}_#_
      ignition_delay_${ignitionDelay?.toFixed(6) ?? 'none'}.json`;
    const resultsBlob = new Blob([JSON.stringify(analysisResults, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(resultsBlob);
    link.download = filename;
    link.click();
  };

  return (
    <Box p={[4, 6, 8]} maxW="1200px" mx="auto">
      <VStack spacing={8} align="stretch">
        <AnalysisControls
          settings={settings}
          setSettings={setSettings}
          handleFileUpload={handleFileUpload}
          runAnalysis={runAnalysis}
          data={data}
        />
        <Box bg="white" shadow="lg" rounded="xl" p={8} w="full">
          <AnalysisResults analysisResults={analysisResults} />
          {analysisResults && (
            <Button
              colorScheme="green"
              size="lg"
              w="full"
              mt={4}
              onClick={saveAnalysisResults}
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