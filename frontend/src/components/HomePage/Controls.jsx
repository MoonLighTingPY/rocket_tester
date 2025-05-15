import { useContext, useState, useEffect } from 'react';
import { HStack, VStack, Button, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, Text, Box } from '@chakra-ui/react';
import { useToast } from '@chakra-ui/toast';
import { socket } from '../../websocket';
import DataContext from '../../hooks/DataContext';
import ReadingContext from '../../hooks/ReadingContext';
import ConnectionLostModal from './ConnectionLostModal';

const Controls = () => {
  const { clearTestData, exportToCsv, clearCsvData, csvData } = useContext(DataContext);
  const { isReading, setIsReading } = useContext(ReadingContext);
  const [isIgnited, setIsIgnited] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(socket.readyState === WebSocket.OPEN);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showConnectionLostModal, setShowConnectionLostModal] = useState(false);
  
  const [timer, setTimer] = useState(10);
  const toast = useToast();

  useEffect(() => {
    const handleOpen = () => setIsSocketConnected(true);
    const handleClose = () => {
      setIsSocketConnected(false);
      if (isReading) {
        // Only show modal if we were actively reading when connection was lost
        setShowConnectionLostModal(true);
        setIsReading(false);
        setIsIgnited(false);
      }
    };


    socket.addEventListener('open', handleOpen);
    socket.addEventListener('close', handleClose);

    return () => {
      socket.removeEventListener('open', handleOpen);
      socket.removeEventListener('close', handleClose);
    };
  }, [isReading, setIsReading]);

  const handleConnectionLostExport = () => {
    exportToCsv();
    setShowConnectionLostModal(false);
    toast({
      title: 'Data exported successfully',
      status: 'success',
      duration: 2000,
    });
  };

  const handleStartReadings = () => {
    if (csvData.length > 0) {
      setIsModalOpen(true);
      setTimer(10);
      return;
    }
    startReadings();
  };

  const startReadings = () => {
    socket.send('start_readings');
    setIsReading(true);
    clearTestData();
    toast({
      title: 'Started readings',
      status: 'success',
      duration: 2000,
    });
  };

  const handleModalStart = () => {
    setIsModalOpen(false);
    startReadings();
    setTimer(10);
  };

  const handleModalCancel = () => {
    setIsModalOpen(false);
    setTimer(10);
  };

  useEffect(() => {
    if (isModalOpen && timer > 0) {
      const countdown = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(countdown);
    }
  }, [isModalOpen, timer]);

  useEffect(() => {
    if (!socket) return;
    
    const handleSocketMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'ignition_detected') {
          setIsIgnited(true);
          toast({
            title: 'Ignition detected',
            description: 'External ignition has been detected',
            status: 'info',
            duration: 2000,
          });
        }
      } catch (error) {
        console.error('Error parsing websocket message:', error);
      }
    };
    
    socket.addEventListener('message', handleSocketMessage);
    
    return () => {
      socket.removeEventListener('message', handleSocketMessage);
    };
  }, [socket, toast]);
  

  const handleEndTest = () => {
    socket.send('end_test');
    setIsReading(false);
    setIsIgnited(false);
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
        <Box
          px={4}
          py={2}
          borderRadius="md"
          bg={isIgnited ? "orange.400" : "gray.200"}
          color={isIgnited ? "white" : "gray.600"}
          fontWeight="bold"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          {isIgnited ? "Ignited" : "Not Ignited"}
        </Box>
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
          isDisabled={csvData.length === 0 || isReading}
        >
          Export CSV
        </Button>
        <Button
          colorScheme="yellow"
          onClick={clearCsvData}
          isDisabled={csvData.length === 0 || isReading}
        >
          Clear CSV Data
        </Button>
      </HStack>
      <ConnectionLostModal 
        isOpen={showConnectionLostModal}
        onClose={() => setShowConnectionLostModal(false)}
        onExport={handleConnectionLostExport}
      />

      <Modal isOpen={isModalOpen} onClose={handleModalCancel}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Warning</ModalHeader>
          <ModalBody>
            <Text>
              There is still CSV data from the previous test. If you start the test, it will add on top of it. It is advised to clear the CSV data before starting a new test. Are you sure you want to continue?
            </Text>
            {csvData.length > 0 && (
              <Text mt={4}>
              You can still start the test in {timer} seconds.
              </Text>)}
            {csvData.length === 0 && (
              <Text mt={4}>
                CSV data cleared. You can start the test now.
              </Text>
            )}
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="red" onClick={handleModalCancel} mr={3} isDisabled={csvData.length === 0}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={() => { clearCsvData(); setTimer(0); }} mr={3} isDisabled={csvData.length === 0}>
              Clear CSV Data
            </Button>
            <Button colorScheme="green" onClick={handleModalStart} isDisabled={timer > 0}>
              Start the Test
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
};

export default Controls;