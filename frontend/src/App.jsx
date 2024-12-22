import { ChakraProvider, ColorModeProvider, CSSReset } from '@chakra-ui/react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Box, VStack, Flex, Button } from '@chakra-ui/react';
import { useDataManager } from './hooks/useDataManager';
import DataContext from './hooks/DataContext';
import HomePage from './components/HomePage';
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
                  <Route path="/" element={<HomePage />} />
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