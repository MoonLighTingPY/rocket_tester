
import { useContext, useRef, useState } from 'react';
import { 
  VStack, Heading, SimpleGrid, GridItem, Box, Text,
  useDisclosure, Modal, ModalOverlay, 
  ModalContent, ModalBody, ModalCloseButton, Button
} from '@chakra-ui/react';
import { chartTheme } from '../config/chartConfig';
import Chart from './Chart';
import ChartControls from './ChartControls';
import Controls from './Controls';
import DataContext from '../hooks/DataContext';
import SensorConfigModal from './SensorConfigModal';


const HomePage = () => {
  const { testData, ignitionDelay, sensorConfig, updateSensorConfig } = useContext(DataContext);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [activeChart, setActiveChart] = useState(null);
  const chartRefs = useRef({
    0: { regular: null, fullScreen: null }, // Load Cell
    1: { regular: null, fullScreen: null }, // Pressure
    2: { regular: null, fullScreen: null }, // Temperature
  });


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
    if (sensor.enabled) { // Only include enabled sensors
      const type = sensor.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(sensor);
    }
    return groups;
  }, {});


  return (
    <VStack spacing={6} w="full">
      <Heading>Rocket Test Dashboard</Heading>
      <Button 
        onClick={() => setIsConfigModalOpen(true)} 
        disabled={!sensorConfig || sensorConfig.length === 0}
      >
        Edit Sensor Config
      </Button>
      <Controls />
      
      {ignitionDelay !== null && (
        <Text fontSize="xl" fontWeight="bold">
          Ignition Delay: {ignitionDelay.toFixed(6)} seconds
        </Text>
      )}

    <SimpleGrid columns={1} spacing={8} w="full">
      {Object.entries(groupedSensors).map(([type, sensors]) => (
        sensors.length > 0 && ( // Only render if there are sensors in this group
          <GridItem key={type}>
            <Box p={6} bg="white" shadow="md" rounded="lg" position="relative">
              <Heading size="md" mb={4}>{sensorTypeLabels[type]}</Heading>
              <ChartControls
                chartRef={chartRefs.current[type]?.regular?.current}
                title={sensorTypeLabels[type]}
                onOpen={onOpen}
                setActiveChart={() => setActiveChart(type)}
                onResetZoom={() => {
                  const chart = chartRefs.current[type]?.regular?.current;
                  if (chart?.resetZoom) {
                    chart.resetZoom();
                  }
                }}
                onDownload={() => {
                  const chart = chartRefs.current[type]?.regular?.current;  // Changed this line
                  if (chart?.toBase64Image) {
                    const link = document.createElement('a');
                    const now = new Date();
                    const localDateTime = now.toLocaleString('sv-SE', { timeZoneName: 'short' })
                      .replace(' ', '_')
                      .replace(':', '-');
                    link.download = `${sensorTypeLabels[type]}-${localDateTime}.png`;
                    link.href = chart.toBase64Image();
                    link.click();
                  }
                }}
              />
              <Chart
                ref={el => {
                  if (el) {
                    chartRefs.current[type] = {
                      ...chartRefs.current[type],
                      regular: {
                        current: el
                      }
                    };
                  }
                }}
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
        )
        ))}
      </SimpleGrid>

      <Modal isOpen={isOpen} onClose={onClose} size="full">
        <ModalOverlay />
        <ModalContent>
          <ModalCloseButton />
          <ModalBody>
            {activeChart !== null && (
              <Chart
              ref={el => {
                if (el) {
                  chartRefs.current[activeChart] = {
                    ...chartRefs.current[activeChart],
                    fullScreen: el
                  };
                }
              }}
                xAxis={testData.map(point => point.ignitionT ? point.ignitionT : point.readingsT)}
                yAxis={groupedSensors[activeChart].map(sensor => testData.map(point => point[sensor.name]))}
                labels={groupedSensors[activeChart].map(sensor => sensor.name)}
                colors={groupedSensors[activeChart].map((_, index) => 
                  sensorTypeColors[activeChart][index % sensorTypeColors[activeChart].length]
                )}
                title={`${sensorTypeLabels[activeChart]} Sensors`}
              />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Sensor Config Modal */}
      <SensorConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        sensorConfig={sensorConfig}
        onSave={updateSensorConfig}
      />
    </VStack>
  );
};

export default HomePage;