import { 
  VStack, Heading, SimpleGrid, GridItem, Box, Text, HStack, 
  Badge, IconButton, useDisclosure, Modal, ModalOverlay, 
  ModalContent, ModalBody, ModalCloseButton
} from '@chakra-ui/react';
import { DownloadIcon, RepeatIcon, ViewIcon } from '@chakra-ui/icons';
import Controls from './Controls';
import Chart from './Chart';
import { useContext, useRef, useState, useEffect } from 'react';
import DataContext from '../hooks/DataContext';
import { chartTheme } from '../config/chartConfig';
import { socket } from '../websocket';

const HomePage = () => {
  const { testData, ignitionDelay } = useContext(DataContext);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [activeChart, setActiveChart] = useState(null);
  const chartRefs = {
    pressure: useRef(),
    load: useRef(),
    temperature: useRef()
  };


  const xAxis = testData.map(point => point.ignitionT ? point.ignitionT : point.readingsT);
  const pressureY = [testData.map(point => point.p1), testData.map(point => point.p2)];
  const loadCellY = [testData.map(point => point.l)];
  const temperatureY = [testData.map(point => point.tp)];

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

          <Box p={6} bg="white" shadow="md" rounded="lg" position="relative">
            <Heading size="md" mb={4}>Pressure Sensors</Heading>
            <ChartControls chartRef={chartRefs.pressure} title="Pressure" />
            <Chart
              ref={chartRefs.pressure}
              xAxis={xAxis}
              yAxis={pressureY}
              labels={['Pressure 1', 'Pressure 2']}
              colors={[chartTheme.colors.pressure1, chartTheme.colors.pressure2]}
              title="Pressure Sensors"
            />
          </Box>

        <GridItem>
          <Box p={6} bg="white" shadow="md" rounded="lg" position="relative">
            <Heading size="md" mb={4}>Load Cell</Heading>
            <ChartControls chartRef={chartRefs.load} title="Load" />
            <Chart
              ref={chartRefs.load}
              xAxis={xAxis}
              yAxis={loadCellY}
              labels={['Load Cell']}
              colors={[chartTheme.colors.loadCell]}
              title="Load Cell"
            />
          </Box>
        </GridItem>
        <GridItem>
          <Box p={6} bg="white" shadow="md" rounded="lg" position="relative">
            <Heading size="md" mb={4}>Temperature</Heading>
            <ChartControls chartRef={chartRefs.temperature} title="Temperature" />
            <Chart
              ref={chartRefs.temperature}
              xAxis={xAxis}
              yAxis={temperatureY}
              labels={['Temperature']}
              colors={[chartTheme.colors.temperature]}
              title="Temperature"
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
              <Chart
                ref={chartRefs.pressure}  // Use the same ref as the main view
                xAxis={xAxis}
                yAxis={pressureY}
                labels={['Pressure 1', 'Pressure 2']}
                colors={[chartTheme.colors.pressure1, chartTheme.colors.pressure2]}
                title="Pressure Sensors"
              />
            )}
            {activeChart === "Load" && (
              <Chart
                ref={chartRefs.load}  // Use the same ref as the main view
                xAxis={xAxis}
                yAxis={loadCellY}
                labels={['Load Cell']}
                colors={[chartTheme.colors.loadCell]}
                title="Load Cell"
              />
            )}
            {activeChart === "Temperature" && (
              <Chart
                ref={chartRefs.temperature}  // Use the same ref as the main view
                xAxis={xAxis}
                yAxis={temperatureY}
                labels={['Temperature']}
                colors={[chartTheme.colors.temperature]}
                title="Temperature"
              />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </VStack>
  );
};

export default HomePage;