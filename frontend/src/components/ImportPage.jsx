import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Line } from 'react-chartjs-2';
import { 
  Box, Heading, Select, Button, Text, SimpleGrid, GridItem, VStack,
  HStack, IconButton, useDisclosure, Modal, ModalOverlay,
  ModalContent, ModalBody, ModalCloseButton
} from '@chakra-ui/react';
import { DownloadIcon, RepeatIcon, ViewIcon } from '@chakra-ui/icons';
import { FormLabel, FormControl } from '@chakra-ui/form-control';
import { NumberInput, NumberInputField } from '@chakra-ui/number-input';
import { applyKalmanFilter, applyGaussianFilter } from '../utils/filters';
import { chartOptions } from '../config/chartConfig';
import Statistics from './Statistics';
import './ImportPage.css';

const ImportPage = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [importedData, setImportedData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [filterType, setFilterType] = useState('none');
  const [kalmanSettings, setKalmanSettings] = useState({ Q: '0.0001', R: '0.01' });
  const [gaussianSettings, setGaussianSettings] = useState({ kernelSize: '5' });
  const [ignitionDelay, setIgnitionDelay] = useState(null);
  const [activeChart, setActiveChart] = useState(null);
  const chartRefs = {
    pressure: useRef(),
    load: useRef(),
    temperature: useRef()
  };


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
      },
    });
  };

  const handleFilterChange = (event) => setFilterType(event.target.value);

  const applyFilter = () => {
    let data = importedData;
    if (filterType === 'kalman') {
      data = applyKalmanFilter(importedData, { Q: parseFloat(kalmanSettings.Q), R: parseFloat(kalmanSettings.R) });
    } else if (filterType === 'gaussian') {
      data = applyGaussianFilter(importedData, { kernelSize: parseInt(gaussianSettings.kernelSize) });
    }
    setFilteredData(data);
  };

  const handleKalmanChange = (field, value) => {
    if (value === '' || !isNaN(value)) {
      setKalmanSettings(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleGaussianChange = (value) => {
    if (value === '' || !isNaN(value)) {
      setGaussianSettings(prev => ({
        ...prev,
        kernelSize: value
      }));
    }
  };

  const charts = {
    pressure: {
      datasets: [
        {
          label: 'Pressure 1',
          data: filteredData.map((point) => ({
            x: point['Timestamp (s)'],
            y: point['Pressure1 (bar)'],
          })),
          borderColor: 'rgb(75, 192, 192)',
          pointRadius: 0,
        },
        {
          label: 'Pressure 2',
          data: filteredData.map((point) => ({
            x: point['Timestamp (s)'],
            y: point['Pressure2 (bar)'],
          })),
          borderColor: 'rgb(255, 99, 132)',
          pointRadius: 0,
        },
      ],
    },
    loadCell: {
      datasets: [{
        label: 'Load Cell',
        data: filteredData.map((point) => ({
          x: point['Timestamp (s)'],
          y: point['Load (kg)'],
        })),
        borderColor: 'rgb(153, 102, 255)',
        pointRadius: 0,
      }],
    },
    temperature: {
      datasets: [{
        label: 'Temperature',
        data: filteredData.map((point) => ({
          x: point['Timestamp (s)'],
          y: point['Temperature (°C)'],
        })),
        borderColor: 'rgb(255, 159, 64)',
        pointRadius: 0,
      }],
    },
  };

  const ChartControls = ({ chartRef, title }) => (
    <HStack spacing={2} position="absolute" top={2} right={2} zIndex={1}>
      <IconButton
        size="sm"
        icon={<RepeatIcon />}
        onClick={() => handleResetZoom(chartRef)}
        aria-label="Reset zoom"
      />
      <IconButton
        size="sm"
        icon={<DownloadIcon />}
        onClick={() => handleDownloadChart(chartRef, title)}
        aria-label="Download chart"
      />
      <IconButton
        size="sm"
        icon={<ViewIcon />}
        onClick={() => {
          setActiveChart(title);
          onOpen();
        }}
        aria-label="Fullscreen"
      />
    </HStack>
  );

  const handleDownloadChart = (chartRef, title) => {
    const link = document.createElement('a');
    const now = new Date();
    const localDateTime = now.toLocaleString('sv-SE', { timeZoneName: 'short' })
      .replace(' ', '_')
      .replace(':', '-');
    link.download = `${title}-${localDateTime}.png`;
    link.href = chartRef.current.toBase64Image();
    link.click();
  };

  const handleResetZoom = (chartRef) => {
    if (chartRef.current) {
      chartRef.current.resetZoom();
    }
  };

  return (
    <Box className="import-page" p={8} w="full">
      <Heading>Import CSV and Apply Filters</Heading>

      {filteredData.length > 0 && (
        <Statistics data={filteredData} />
      )}
          
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

      {filterType === 'kalman' && (
        <VStack spacing={4}>
          <FormControl>
            <FormLabel>Q Value</FormLabel>
            <NumberInput step={0.0001} min={0} value={kalmanSettings.Q}>
              <NumberInputField
                value={kalmanSettings.Q}
                onChange={(e) => handleKalmanChange('Q', e.target.value)}
              />
            </NumberInput>
          </FormControl>
          <FormControl>
            <FormLabel>R Value</FormLabel>
            <NumberInput step={0.01} min={0} value={kalmanSettings.R}>
              <NumberInputField
                value={kalmanSettings.R}
                onChange={(e) => handleKalmanChange('R', e.target.value)}
              />
            </NumberInput>
          </FormControl>
        </VStack>
      )}

      {filterType === 'gaussian' && (
        <FormControl>
          <FormLabel>Kernel Size</FormLabel>
          <NumberInput step={2} min={3} value={gaussianSettings.kernelSize}>
            <NumberInputField
              value={gaussianSettings.kernelSize}
              onChange={(e) => handleGaussianChange(e.target.value)}
            />
          </NumberInput>
        </FormControl>
      )}

      <Button colorScheme="blue" onClick={applyFilter}>
        Apply Filter
      </Button>

      {ignitionDelay !== null && (
        <Text fontSize="xl" fontWeight="bold">
          Ignition Delay: {ignitionDelay.toFixed(6)} seconds
        </Text>
      )}

      <SimpleGrid columns={[1]} spacing={8} w="full">
        <GridItem>
        <Box p={6} bg="white" shadow="md" rounded="lg" position="relative">
            <Heading size="md" mb={4}>Pressure Sensors</Heading>
            <ChartControls chartRef={chartRefs.pressure} title="Pressure" />
            <Line 
              ref={chartRefs.pressure}
              options={chartOptions("Pressure Sensors", ignitionDelay)} 
              data={charts.pressure} 
            />
          </Box>
        </GridItem>
        <GridItem>
          <Box p={6} bg="white" shadow="md" rounded="lg" position="relative">
            <Heading size="md" mb={4}>Load Cell</Heading>
            <ChartControls chartRef={chartRefs.load} title="Load" />
            <Line 
              ref={chartRefs.load}
              options={chartOptions("Load Sensor", ignitionDelay)} 
              data={charts.loadCell} 
            />
          </Box>
        </GridItem>
        <GridItem>
          <Box p={6} bg="white" shadow="md" rounded="lg" position="relative">
            <Heading size="md" mb={4}>Temperature</Heading>
            <ChartControls chartRef={chartRefs.temperature} title="Temperature" />
            <Line 
              ref={chartRefs.temperature}
              options={chartOptions("Temperature Sensor", ignitionDelay)} 
              data={charts.temperature} 
            />
          </Box>
        </GridItem>
      </SimpleGrid>
      <Modal isOpen={isOpen} onClose={onClose} size="full">
        <ModalOverlay />
        <ModalContent>
          <ModalCloseButton />
          <ModalBody>
            {activeChart === "Pressure" && (
              <Line 
                options={chartOptions("Pressure Sensors", ignitionDelay)} 
                data={charts.pressure} 
              />
            )}
            {activeChart === "Load" && (
              <Line 
                options={chartOptions("Load Sensor", ignitionDelay)} 
                data={charts.loadCell} 
              />
            )}
            {activeChart === "Temperature" && (
              <Line 
                options={chartOptions("Temperature Sensor", ignitionDelay)} 
                data={charts.temperature} 
              />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default ImportPage;