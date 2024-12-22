import { ChakraProvider, ColorModeProvider, CSSReset } from '@chakra-ui/react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Box, VStack, Heading, Flex, Button, SimpleGrid, GridItem, Text } from '@chakra-ui/react';
import { useDataManager } from './hooks/useDataManager';
import DataContext from './hooks/DataContext';
import { ChartControls, PressureChart, LoadCellChart, TemperatureChart } from './components/Charts';
import Controls from './components/Controls';
import ImportPage from './components/ImportPage';
import "./App.css"

function App() {
  const dataManager = useDataManager();

  return (
    <ChakraProvider>
      <ColorModeProvider>
        <CSSReset />
        <DataContext.Provider value={dataManager}>
          <Router>
            <Box minH="100vh" bg="gray.50" p={8}>
              <VStack spacing={8} mx="auto" w="full">
                <Flex as="nav" gap={4}>
                  <Link to="/">
                    <Button colorScheme="blue">Home</Button>
                  </Link>
                  <Link to="/import">
                    <Button colorScheme="green">Import CSV</Button>
                  </Link>
                </Flex>
                
                <Routes>
                  <Route path="/" element={
                    <VStack spacing={6} w="full">
                      <Heading>Rocket Test Dashboard</Heading>
                      <Controls />
                      {dataManager.ignitionDelay !== null && (
                        <Text fontSize="xl" fontWeight="bold">
                          Ignition Delay: {dataManager.ignitionDelay.toFixed(6)} seconds
                        </Text>
                      )}
                      <ChartControls />
                      <SimpleGrid columns={[1, null, 2]} spacing={8} w="full">
                        <GridItem>
                          <Box p={6} bg="white" shadow="md" rounded="lg">
                            <Heading size="md" mb={4}>Pressure Sensors</Heading>
                            <PressureChart />
                          </Box>
                        </GridItem>
                        <GridItem>
                          <Box p={6} bg="white" shadow="md" rounded="lg">
                            <Heading size="md" mb={4}>Load Cell</Heading>
                            <LoadCellChart />
                          </Box>
                        </GridItem>
                        <GridItem>
                          <Box p={6} bg="white" shadow="md" rounded="lg">
                            <Heading size="md" mb={4}>Temperature</Heading>
                            <TemperatureChart />
                          </Box>
                        </GridItem>
                      </SimpleGrid>
                    </VStack>
                  } />
                  <Route path="/import" element={<ImportPage />} />
                </Routes>
              </VStack>
            </Box>
          </Router>
        </DataContext.Provider>
      </ColorModeProvider>
    </ChakraProvider>
  );
}

export default App;