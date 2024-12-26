import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Line } from 'react-chartjs-2';
import { 
  Box, Heading, Checkbox, CheckboxGroup, Button, Text, SimpleGrid, GridItem, VStack,
  useDisclosure, FormControl, FormLabel, Select
} from '@chakra-ui/react';
import { applyKalmanFilter, applyGaussianFilter } from '../utils/filters';
import { chartOptions } from '../config/chartConfig';
import Statistics from './Statistics';
import ChartControls from './ChartControls';
import FilterSettings from './FilterSettings';
import './ImportPage.css';

const ImportPage = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [importedData, setImportedData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [filterType, setFilterType] = useState('none');
  const [filterTargets, setFilterTargets] = useState([]);
  const [kalmanSettings, setKalmanSettings] = useState({ Q: '0.0001', R: '0.01' });
  const [gaussianSettings, setGaussianSettings] = useState({ kernelSize: '5' });
  const [ignitionDelay, setIgnitionDelay] = useState(null);
  const [activeChart, setActiveChart] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const chartRefs = useRef({});

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    const filename = file.name;
    const delayMatch = filename.match(/ignition_delay_([\d.]+)\.csv$/);
    
    if (delayMatch) {
      setIgnitionDelay(parseFloat(delayMatch[1]));
    } else {
      setIgnitionDelay(null);
    }

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      complete: (results) => {
        setImportedData(results.data);
        setFilteredData(results.data);
        setCsvHeaders(Object.keys(results.data[0]).filter(header => header !== 'Timestamp (s)'));
      },
    });
  };

  const handleFilterChange = (event) => setFilterType(event.target.value);
  const handleFilterTargetsChange = (values) => setFilterTargets(values);

  const applyFilter = () => {
    let data = importedData;
    filterTargets.forEach(target => {
      if (filterType === 'kalman') {
        data = applyKalmanFilter(data, { Q: parseFloat(kalmanSettings.Q), R: parseFloat(kalmanSettings.R) }, target);
      } else if (filterType === 'gaussian') {
        data = applyGaussianFilter(data, { kernelSize: parseInt(gaussianSettings.kernelSize) }, target);
      }
    });
    // Format filtered data to 6 decimal points
    const formattedData = data.map(point => {
      const formattedPoint = { ...point };
      filterTargets.forEach(target => {
        formattedPoint[target] = parseFloat(point[target].toFixed(6));
      });
      return formattedPoint;
    });
    setFilteredData(formattedData);
  };

  const saveFilteredData = () => {
    const csv = Papa.unparse(filteredData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const now = new Date();
    const localDateTime = now.toLocaleString('sv-SE', { timeZoneName: 'short' })
      .replace(' ', '_')
      .replace(':', '-');
    const filename = `filtered_data_${filterTargets.join('_')}_${localDateTime}${ignitionDelay !== null ? `_ignition_delay_${ignitionDelay.toFixed(6)}` : ''}.csv`;
    link.download = filename;
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  const generateColor = (index) => {
    const colors = [
      'rgb(75, 192, 192)',
      'rgb(255, 99, 132)',
      'rgb(153, 102, 255)',
      'rgb(255, 159, 64)',
      'rgb(54, 162, 235)',
      'rgb(255, 206, 86)',
      'rgb(75, 192, 192)',
      'rgb(255, 99, 132)',
      'rgb(153, 102, 255)',
      'rgb(255, 159, 64)',
    ];
    return colors[index % colors.length];
  };

  const generateChartData = (data, target, index) => ({
    datasets: [
      {
        label: target,
        data: data.map((point) => ({
          x: point['Timestamp (s)'],
          y: point[target],
        })),
        borderColor: generateColor(index),
        pointRadius: 0,
      },
    ],
  });

  return (
    <Box className="import-page" p={8} w="full">
      <Heading>Import CSV and Apply Filters</Heading>
      <FormControl>
        <FormLabel>Upload CSV File</FormLabel>
        <input type="file" accept=".csv" onChange={handleFileUpload} />
      </FormControl>

      <FormControl>
        <FormLabel>Filter Type</FormLabel>
        <Select value={filterType} onChange={handleFilterChange}>
          <option value="none">None</option>
          <option value="kalman">Kalman Filter</option>
          <option value="gaussian">Gaussian Filter</option>
        </Select>
      </FormControl>

      <FormControl>
        <FormLabel>Filter Targets</FormLabel>
        <CheckboxGroup value={filterTargets} onChange={handleFilterTargetsChange}>
          <VStack align="start">
            {csvHeaders.map(header => (
              <Checkbox key={header} value={header}>{header}</Checkbox>
            ))}
          </VStack>
        </CheckboxGroup>
      </FormControl>

      <FilterSettings 
        filterType={filterType} 
        kalmanSettings={kalmanSettings} 
        setKalmanSettings={setKalmanSettings} 
        gaussianSettings={gaussianSettings} 
        setGaussianSettings={setGaussianSettings} 
      />

      <Button colorScheme="blue" onClick={applyFilter} isDisabled={filterType === 'none'}>
        Apply Filter
      </Button>

      <Button colorScheme="green" onClick={saveFilteredData} mt={4} mb={4} isDisabled={filteredData.length === 0}>
        Save Filtered Data
      </Button>

      {ignitionDelay !== null && (
        <Text fontSize="xl" fontWeight="bold">
          Ignition Delay: {ignitionDelay.toFixed(6)} seconds
        </Text>
      )}

      {filteredData.length > 0 && (
        <SimpleGrid columns={[1, null, 2]} spacing={8} w="full">
          {csvHeaders.map((header, index) => (
            <GridItem key={header}>
              <Box p={6} bg="white" shadow="md" rounded="lg" position="relative">
                <Heading size="md" mb={4}>{header}</Heading>
                <ChartControls chartRef={chartRefs.current[header]} title={header} />
                <Line 
                  ref={el => chartRefs.current[header] = el}
                  options={chartOptions(header, ignitionDelay)} 
                  data={generateChartData(filteredData, header, index)} 
                />
              </Box>
            </GridItem>
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
};

export default ImportPage;