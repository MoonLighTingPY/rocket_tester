import { useContext, useState, useEffect } from 'react';
import { HStack, VStack, Button } from '@chakra-ui/react';
import { useToast } from '@chakra-ui/toast';
import { socket } from '../websocket';
import DataContext from '../hooks/DataContext';

const Controls = () => {
  const { clearTestData, exportToCsv, clearCsvData, csvData } = useContext(DataContext);
  const [isSocketConnected, setIsSocketConnected] = useState(socket.readyState === WebSocket.OPEN);
  const [isReading, setIsReading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const handleOpen = () => setIsSocketConnected(true);
    const handleClose = () => {
      setIsSocketConnected(false);
      setIsReading(false); // Reset reading state when connection is lost
    };

    socket.addEventListener('open', handleOpen);
    socket.addEventListener('close', handleClose);

    return () => {
      socket.removeEventListener('open', handleOpen);
      socket.removeEventListener('close', handleClose);
    };
  }, []);

  const handleStartReadings = () => {
    socket.send('start_readings');
    setIsReading(true);
    clearTestData();
    toast({
      title: 'Started readings',
      status: 'success',
      duration: 2000,
    });
  };

  const handleIgnite = () => {
    socket.send('start_ignition');
    toast({
      title: 'Ignition started',
      status: 'info',
      duration: 2000,
    });
  };

  const handleEndTest = () => {
    socket.send('end_test');
    setIsReading(false);
    toast({
      title: 'Test ended',
      status: 'info',
      duration: 2000,
    });
  };

  const handleExport = () => {
    exportToCsv();
    toast({
      title: 'CSV Exported',
      status: 'success',
      duration: 2000,
    });
  };

  return (
    <VStack spacing={4}>
      <HStack spacing={4}>
        <Button
          colorScheme="green"
          onClick={handleStartReadings}
          isDisabled={!isSocketConnected || isReading}
        >
          Start
        </Button>
        <Button
          colorScheme="orange"
          onClick={handleIgnite}
          isDisabled={!isSocketConnected || !isReading}
        >
          Ignite
        </Button>
        <Button
          colorScheme="red"
          onClick={handleEndTest}
          isDisabled={!isSocketConnected || !isReading}
        >
          Stop
        </Button>
      </HStack>
      <HStack spacing={4}>
        <Button
          colorScheme="blue"
          onClick={handleExport}
          isDisabled={csvData.length === 0}
        >
          Export CSV
        </Button>
        <Button
          colorScheme="yellow"
          onClick={clearCsvData}
          isDisabled={csvData.length === 0}
        >
          Clear CSV Data
        </Button>
      </HStack>
    </VStack>
  );
};

export default Controls;