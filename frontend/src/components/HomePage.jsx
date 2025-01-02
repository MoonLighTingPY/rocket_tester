/* eslint-disable react/prop-types */
import { 
  VStack, Heading, SimpleGrid, GridItem, Box, Text,
  useDisclosure, Modal, ModalOverlay, 
  ModalContent, ModalBody, ModalCloseButton
} from '@chakra-ui/react';
import Controls from './Controls';
import Chart from './Chart';
import ChartControls from './ChartControls';
import { useContext, useRef, useState } from 'react';
import DataContext from '../hooks/DataContext';
import { chartTheme } from '../config/chartConfig';


const HomePage = () => {
  const { testData, ignitionDelay, sensorConfig } = useContext(DataContext);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [activeChart, setActiveChart] = useState(null);
  const chartRefs = {
    fullScreen: useRef(),
    regular: useRef()
  };

  // Define sensor type labels and colors
  // Map numerical SensorType to string labels
  const sensorTypeLabels = {
    0: 'Load Cell',
    1: 'Pressure',
    2: 'Temperature',

    default: 'Unknown Sensor',
  };

  // Map numerical SensorType to corresponding colors
  const sensorTypeColors = {
    0: chartTheme.colors.loadCell,
    1: chartTheme.colors.pressure,
    2: chartTheme.colors.temperature,

    default: '#000000', // Fallback color
  };

  // Group sensors by type (numerical)
  const groupedSensors = sensorConfig.reduce((groups, sensor) => {
    const type = sensor.type; // Numerical type
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(sensor);
    return groups;
  }, {});


  return (
    <VStack spacing={6} w="full">
      <Heading>Rocket Test Dashboard</Heading>
      <Controls />
      
      {ignitionDelay !== null && (
        <Text fontSize="xl" fontWeight="bold">
          Ignition Delay: {ignitionDelay.toFixed(6)} seconds
        </Text>
      )}

<SimpleGrid columns={1} spacing={8} w="full">
        {Object.keys(groupedSensors).map((type) => (
          <GridItem key={type}>
            <Box p={6} bg="white" shadow="md" rounded="lg" position="relative">
              <Heading size="md" mb={4}>{sensorTypeLabels[type]}</Heading>
              <ChartControls 
                chartRef={chartRefs.regular}
                fullScreenRef={chartRefs.fullScreen}
                title={sensorTypeLabels[type]}
                onOpen={onOpen}
                setActiveChart={setActiveChart}
              />
              <Chart
                ref={chartRefs.regular}
                xAxis={testData.map(point => point.ignitionT ? point.ignitionT : point.readingsT)}
                yAxis={groupedSensors[type].map(sensor => testData.map(point => point[sensor.name]))}
                labels={groupedSensors[type].map(sensor => sensor.name)}
                colors={groupedSensors[type].map((_, index) => 
                  sensorTypeColors[type][index % sensorTypeColors[type].length]
                )}
                title={`${sensorTypeLabels[type]} Sensors`}
              />
            </Box>
          </GridItem>
        ))}
      </SimpleGrid>

      <Modal isOpen={isOpen} onClose={onClose} size="full">
        <ModalOverlay />
        <ModalContent>
          <ModalCloseButton />
          <ModalBody>
          {activeChart && (
              <Chart
                ref={chartRefs.fullScreen}
                xAxis={testData.map(point => point.ignitionT ? point.ignitionT : point.readingsT)}
                yAxis={groupedSensors[activeChart].map(sensor => testData.map(point => point[sensor.name]))}
                labels={groupedSensors[activeChart].map(sensor => sensor.name)}
                colors={groupedSensors[activeChart].map((_, index) => sensorTypeColors[activeChart][index % sensorTypeColors[activeChart].length])}
                title={`${sensorTypeLabels[activeChart]} Sensors`}
              />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </VStack>
  );
};

export default HomePage;