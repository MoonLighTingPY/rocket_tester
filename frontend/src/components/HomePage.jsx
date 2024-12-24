import { VStack, Heading, SimpleGrid, GridItem, Box, Text } from '@chakra-ui/react';
import Controls from './Controls';
import Chart from './Chart';
import { useContext } from 'react';
import DataContext from '../hooks/DataContext';
import { chartTheme } from '../config/chartConfig';

const HomePage = () => {
  const { testData, ignitionDelay } = useContext(DataContext);

  const xAxis = testData.map(point => point.ignitionT ? point.ignitionT : point.readingsT);
  const pressureY = [testData.map(point => point.p1), testData.map(point => point.p2)];
  const loadCellY = [testData.map(point => point.l)];
  const temperatureY = [testData.map(point => point.tp)];

  return (
    <VStack spacing={6} w="full">
      <Heading>Rocket Test Dashboard</Heading>
      <Controls />
      {ignitionDelay !== null && (
        <Text fontSize="xl" fontWeight="bold">
          Ignition Delay: {ignitionDelay.toFixed(6)} seconds
        </Text>
      )}
      <SimpleGrid columns={[1, null, 2]} spacing={8} w="full">
        <GridItem>
          <Box p={6} bg="white" shadow="md" rounded="lg">
            <Heading size="md" mb={4}>Pressure Sensors</Heading>
            <Chart
              xAxis={xAxis}
              yAxis={pressureY}
              labels={['Pressure 1', 'Pressure 2']}
              colors={[chartTheme.colors.pressure1, chartTheme.colors.pressure2]}
              title="Pressure Sensors"
            />
          </Box>
        </GridItem>
        <GridItem>
          <Box p={6} bg="white" shadow="md" rounded="lg">
            <Heading size="md" mb={4}>Load Cell</Heading>
            <Chart
              xAxis={xAxis}
              yAxis={loadCellY}
              labels={['Load Cell']}
              colors={[chartTheme.colors.loadCell]}
              title="Load Cell"
            />
          </Box>
        </GridItem>
        <GridItem>
          <Box p={6} bg="white" shadow="md" rounded="lg">
            <Heading size="md" mb={4}>Temperature</Heading>
            <Chart
              xAxis={xAxis}
              yAxis={temperatureY}
              labels={['Temperature']}
              colors={[chartTheme.colors.temperature]}
              title="Temperature"
            />
          </Box>
        </GridItem>
      </SimpleGrid>
    </VStack>
  );
};

export default HomePage;