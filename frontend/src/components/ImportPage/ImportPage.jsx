import { useState, useRef, useEffect } from 'react';
import { BiFilter} from 'react-icons/bi';
import Papa from 'papaparse';
import { Line } from 'react-chartjs-2';
import { 
  Box, Heading, Checkbox, CheckboxGroup, Button, Text, SimpleGrid, GridItem, VStack,
  useDisclosure, FormControl, FormLabel, Select, Modal, ModalOverlay,
  ModalContent, ModalBody, ModalCloseButton, useToast
} from '@chakra-ui/react';
import { DownloadIcon, RepeatIcon } from '@chakra-ui/icons';
import { Icon, HStack } from '@chakra-ui/react';
import { applyKalmanFilter, applyGaussianFilter } from '../../utils/filters';
import { chartOptions } from '../../config/chartConfig';
import ChartControls from '../Chart/ChartControls';
import FilterSettings from './FilterSettings';
import DataConversionOptions from './DataConversionOptions';
import './ImportPage.css';

const ImportPage = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [importedData, setImportedData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [filterType, setFilterType] = useState('kalman');
  const [filterTargets, setFilterTargets] = useState([]);
  const [kalmanSettings, setKalmanSettings] = useState({ Q: '0.0001', R: '0.01' });
  const [gaussianSettings, setGaussianSettings] = useState({ kernelSize: '5' });
  const [ignitionDelay, setIgnitionDelay] = useState(null);
  const [activeChart, setActiveChart] = useState(null);
  const [activeChartData, setActiveChartData] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const toast = useToast();
  const chartRefs = useRef({});

  // Initialize refs when csvHeaders change
  // Fullscreen chart refs create a new object with the same keys so that they can be reset independently
  // This is necessary because the chartjs-plugin-zoom plugin does not work with multiple charts using the same ref
  useEffect(() => {
    const newRefs = {};
    csvHeaders.forEach(header => {
      newRefs[header] = chartRefs.current[header] || null;
    });
    chartRefs.current = newRefs;
  }, [csvHeaders]);

  const applyDataConversion = (conversionData) => {
    if (!importedData.length || !filterTargets.length) return;
  
    const { conversionFactor, offset } = conversionData;
    
    // Track if we're working with filtered or original data
    const baseData = filteredData.length > 0 ? filteredData : importedData;
    
    const convertedData = baseData.map(point => {
      const newPoint = { ...point };
      filterTargets.forEach(target => {
        // Apply conversion: multiply by factor then add offset
        newPoint[target] = (point[target] * conversionFactor) + offset;
      });
      return newPoint;
    });
  
    // Store the converted data
    setFilteredData(convertedData);
    
    toast({
      title: "Data conversion applied",
      description: `Applied factor ${conversionFactor} and offset ${offset} to ${filterTargets.length} channel(s)`,
      status: "success",
      duration: 3000,
      isClosable: true,
    });
  };

  const handleDownloadChart = (header) => {
    const chartInstance = chartRefs.current[header]?.current;
    if (!chartInstance) return;
      
    const link = document.createElement('a');
    const now = new Date();
    const localDateTime = now.toLocaleString('sv-SE', { timeZoneName: 'short' })
      .replace(' ', '_')
      .replace(':', '-');
    link.download = `${header}-${localDateTime}.png`;
    link.href = chartInstance.toBase64Image();
    link.click();
  };

  const safeResetZoom = (header) => {
    // Wait for next render cycle
    requestAnimationFrame(() => {
      // Get both chart instances
      const fullScreenChart = chartRefs.current[header]?.fullScreen?.current;
      const regularChart = chartRefs.current[header]?.current;
      
      const resetChart = (chart) => {
        if (!chart) return;
        
        try {
          // Ensure chart is mounted and initialized
          if (chart.ctx && chart.canvas && typeof chart.resetZoom === 'function') {
            chart.resetZoom();
          }
        } catch (err) {
          console.warn('Failed to reset zoom:', err);
        }
      };
  
      // Reset both charts with a small delay between them
      if (fullScreenChart) {
        setTimeout(() => resetChart(fullScreenChart), 10);
      }
      if (regularChart) {
        setTimeout(() => resetChart(regularChart), 20); 
      }
    });
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
        // Get all headers except timestamp
        const headers = Object.keys(results.data[0]).filter(header => header !== 'Timestamp (s)');
        setCsvHeaders(headers);
        // Select all sensor headers
        setFilterTargets(headers);
      },
    });
  };

  const handleFilterChange = (event) => setFilterType(event.target.value);

  const handleFilterTargetsChange = (values) => setFilterTargets(values);

  const applyFilter = () => {
    // Use filteredData as a base if it exists, otherwise use importedData
    const baseData = filteredData.length > 0 ? filteredData : importedData;
    
    let data = [...baseData]; // Create a copy to avoid mutating the source
    
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
    
    // toast notification for applying filter
    toast({
      title: "Filter applied",
      description: `Applied ${filterType} filter to ${filterTargets.length} channel(s)`,
      status: "success",
      duration: 3000,
      isClosable: true,
    });
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
    <Box className="import-page" p={8} mx="auto">
      <VStack spacing={8} align="stretch" bg="white" p={8} borderRadius="xl" boxShadow="lg">
        <Heading textAlign="center" color="blue.600">Import and Filter CSV Data</Heading>

        <Box bg="gray.50" p={6} borderRadius="md" border="2px dashed" borderColor="gray.200">
          <FormControl>
            <FormLabel fontWeight="bold">Upload CSV File</FormLabel>
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileUpload}
              style={{
                width: '100%',
                padding: '10px',
                cursor: 'pointer'
              }}
            />
            
          </FormControl>

          <Box>
            <Heading size="md" mb={4} color="purple.600">Targets</Heading>
            <FormControl>
              <Box bg="white" p={4} borderRadius="md" boxShadow="sm">
                <HStack align="start" spacing={4} w="100%">
                  {/* Load */}
                  {csvHeaders.filter(header => header.toLowerCase().includes('(kg)')).length > 0 && (
                    <Box w="100%">
                      <Heading size="sm" mb={3} color="blue.600">Load Cell Sensors</Heading>
                      <CheckboxGroup value={filterTargets} onChange={handleFilterTargetsChange}>
                        <HStack spacing={6} wrap="wrap">
                          {csvHeaders
                            .filter(header => header.toLowerCase().includes('(kg)'))
                            .map(header => (
                              <Checkbox key={header} value={header} colorScheme="blue">
                                {header}
                              </Checkbox>
                            ))}
                        </HStack>
                      </CheckboxGroup>
                    </Box>
                  )}

                  {/* Pressure */}
                  {csvHeaders.filter(header => header.toLowerCase().includes('(bar)')).length > 0 && (
                    <Box w="100%">
                      <Heading size="sm" mb={3} color="green.600">Pressure Sensors</Heading>
                      <CheckboxGroup value={filterTargets} onChange={handleFilterTargetsChange}>
                        <HStack spacing={6} wrap="wrap">
                          {csvHeaders
                            .filter(header => header.toLowerCase().includes('(bar)'))
                            .map(header => (
                              <Checkbox key={header} value={header} colorScheme="green">
                                {header}
                              </Checkbox>
                            ))}
                        </HStack>
                      </CheckboxGroup>
                    </Box>
                  )}

                  {/* Temperature */}
                  {csvHeaders.filter(header => header.toLowerCase().includes('(°c)')).length > 0 && (
                    <Box w="100%">
                      <Heading size="sm" mb={3} color="orange.600">Temperature Sensors</Heading>
                      <CheckboxGroup value={filterTargets} onChange={handleFilterTargetsChange}>
                        <HStack spacing={6} wrap="wrap">
                          {csvHeaders
                            .filter(header => header.toLowerCase().includes('(°c)'))
                            .map(header => (
                              <Checkbox key={header} value={header} colorScheme="orange">
                                {header}
                              </Checkbox>
                            ))}
                        </HStack>
                      </CheckboxGroup>
                    </Box>
                  )}
                </HStack>
              </Box>
                    
            </FormControl>
          </Box>
          
        </Box>
        <Box bg="gray.50" p={6} borderRadius="md" border="1px solid" borderColor="gray.200">
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
            {/* Left Column - Data Conversion */}
            <Box borderRight={{ base: "none", md: "1px solid" }} borderColor="gray.200" pr={{ base: 0, md: 6 }}>
              <Heading size="md" mb={4} color="teal.600">Data Conversion</Heading>
              <DataConversionOptions 
                onApplyConversion={applyDataConversion} 
                filterTargets={filterTargets}
              />
            </Box>

            {/* Right Column */}
            <Box pl={{ base: 1, md: 6 }}>
              <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
                {/* Filter Settings Column */}
                <Box>
                  <Heading size="md" mb={4} color="blue.600">Filter Settings</Heading>
                  <FormControl mb={4}>
                    <FormLabel fontWeight="bold">Filter Type</FormLabel>
                    <Select 
                      value={filterType} 
                      onChange={handleFilterChange}
                      bg="white"
                      size="lg"
                    >
                      <option value="kalman">Kalman Filter</option>
                      <option value="gaussian">Gaussian Filter</option>
                    </Select>
                    <Box bg="white" p={4} borderRadius="md" mt={3} boxShadow="sm">
                      <FilterSettings 
                        filterType={filterType} 
                        kalmanSettings={kalmanSettings} 
                        setKalmanSettings={setKalmanSettings} 
                        gaussianSettings={gaussianSettings} 
                        setGaussianSettings={setGaussianSettings} 
                      />
                      
                    </Box>
                  </FormControl>
                  <Button 
                    colorScheme="blue" 
                    onClick={applyFilter} 
                    isDisabled={filterType === 'none' || filterTargets.length === 0}
                    size="lg"
                    leftIcon={<Icon as={BiFilter} />}
                  >
    Apply Filter
                  </Button>
                </Box>
              </SimpleGrid>
            </Box>
          </SimpleGrid>
        </Box>

          




        {/* Action Buttons */}
        <HStack spacing={4} justify="center">
          <Button 
            colorScheme="orange" 
            onClick={() => {
              setFilteredData([]);
              toast({
                title: "Changes reverted",
                description: "All filtering and conversion changes have been reverted",
                status: "info",
                duration: 3000,
                isClosable: true,
              });
            }} 
            isDisabled={filteredData.length === 0}
            size="lg"
            leftIcon={<Icon as={RepeatIcon} />}
          >
  Revert Everything
          </Button>
          <Button 
            colorScheme="green" 
            onClick={saveFilteredData} 
            isDisabled={filteredData.length === 0}
            size="lg"
            leftIcon={<DownloadIcon />}
          >
    Save Filtered Data
          </Button>
        </HStack>

        {/* Ignition Delay Display */}
        {ignitionDelay !== null && (
          <Box textAlign="center" p={4} bg="blue.50" borderRadius="md">
            <Text fontSize="xl" fontWeight="bold" color="blue.600">
          Ignition Delay: {ignitionDelay.toFixed(6)} seconds
            </Text>
          </Box>
        )}
      </VStack>

      {/* Charts */}
      {(filteredData.length > 0 || importedData.length > 0) && (
        <SimpleGrid columns={[1, null, 2]} spacing={8} w="full">
          {csvHeaders.map((header, index) => (
            <GridItem key={header}>
              <Box p={6} bg="white" shadow="md" rounded="lg" position="relative">
                <Heading size="md" mb={4}>{header}</Heading>
                <ChartControls 
                  chartRef={chartRefs.current[header]}
                  title={header}
                  onDownload={() => handleDownloadChart(header)}
                  onResetZoom={() => safeResetZoom(header)} 
                  onOpen={() => {
                    setActiveChart(header);
                    setActiveChartData(generateChartData(
                      filteredData.length > 0 ? filteredData : importedData, 
                      header, 
                      index
                    ));
                    onOpen();
                  }}
                  setActiveChart={setActiveChart}
                />
                <Line 
                  ref={el => {
                    if (el) {
                      chartRefs.current[header] = {
                        current: el,
                        resetZoom: () => safeResetZoom(header)
                      };
                    }
                  }}
                  options={chartOptions(header, ignitionDelay)}
                  data={generateChartData(
                    filteredData.length > 0 ? filteredData : importedData, 
                    header, 
                    index
                  )}
                />
              </Box>
            </GridItem>
          ))}
        </SimpleGrid>
      )}

      <Modal isOpen={isOpen} onClose={onClose} size="full">
        <ModalOverlay />
        <ModalContent>
          <ModalCloseButton />
          <ModalBody>
            {activeChart && (
              <Line 
                ref={el => {
                  if (el) {
                    // Store both regular and fullscreen refs
                    chartRefs.current[activeChart] = {
                      ...chartRefs.current[activeChart],
                      fullScreen: {
                        current: el,
                        resetZoom: () => safeResetZoom(activeChart)
                      }
                    };
                  }
                }}
                options={chartOptions(activeChart, ignitionDelay)}
                data={activeChartData || generateChartData(filteredData, activeChart, csvHeaders.indexOf(activeChart))}
              />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};
export default ImportPage;