import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Box, VStack, Flex, Button, ChakraProvider, ColorModeProvider, CSSReset } from '@chakra-ui/react';
import { useDataManager } from './hooks/useDataManager';
import { ReadingProvider } from './hooks/ReadingContext';
import { useState } from 'react';
import DataContext from './hooks/DataContext';
import HomePage from './components/HomePage';
import ImportPage from './components/ImportPage';
import AnalysisPage from './components/AnalysisPage';
import OTAModal from './components/OTAModal';
import "./App.css"

function App() {
  const [isOTAModalOpen, setIsOTAModalOpen] = useState(false);
  const dataManager = useDataManager();
  return (
    <ChakraProvider>
      <ColorModeProvider>
        <CSSReset />
        <DataContext.Provider value={dataManager}>
          <ReadingProvider>
            <Router>
              <Box minH="100vh" bg="gray.50" p={8}>
                <VStack spacing={8} mx="auto" w="full">
                  <Flex as="nav" gap={4}>
                    <Link to="/">
                      <Button colorScheme="blue">Home</Button>
                    </Link>
                    <Link to="/filter">
                      <Button colorScheme="green">Filter CSV</Button>
                    </Link>
                    <Link to="/analysis">
                      <Button colorScheme="purple">Analysis</Button>
                    </Link>
                    <Link onClick={() => setIsOTAModalOpen(true)}>
                      <Button colorScheme="gray">OTA Update</Button>
                    </Link>
                    {/* Add OTA modal */}
                    <OTAModal 
                      isOpen={isOTAModalOpen} 
                      onClose={() => setIsOTAModalOpen(false)} 
                    />
                  </Flex>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/filter" element={<ImportPage />} />
                    <Route path="/analysis" element={<AnalysisPage />} />
                  </Routes>
                </VStack>
              </Box>
            </Router>
          </ReadingProvider>
        </DataContext.Provider>
      </ColorModeProvider>
    </ChakraProvider>
  );
}

export default App;