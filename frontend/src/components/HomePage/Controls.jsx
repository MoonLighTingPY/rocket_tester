import { useContext, useState, useEffect } from 'react';
import { HStack, VStack, Button, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, Text } from '@chakra-ui/react';
import { useToast } from '@chakra-ui/toast';
import { socket } from '../../websocket';
import DataContext from '../../hooks/DataContext';
import ReadingContext from '../../hooks/ReadingContext';

const Controls = () => {
  const { clearTestData, exportToCsv, clearCsvData, csvData } = useContext(DataContext);
  const { isReading, setIsReading } = useContext(ReadingContext);
  const [isIgnited, setIsIgnited] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(socket.readyState === WebSocket.OPEN);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [timer, setTimer] = useState(10);
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
  }, [setIsReading]);

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

  const handleIgnite = () => {
    setIsIgnited(true);
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
        <Button
          colorScheme="orange"
          onClick={handleIgnite}
          isDisabled={!isSocketConnected || !isReading || isIgnited}
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