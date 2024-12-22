import { useContext, useState, useEffect } from 'react';
import { HStack, Button} from '@chakra-ui/react';
import { useToast } from '@chakra-ui/toast';
import { socket } from '../websocket';
import DataContext from '../hooks/DataContext';

const Controls = () => {
  const { clearTestData } = useContext(DataContext);
  const [isSocketConnected, setIsSocketConnected] = useState(socket.readyState === WebSocket.OPEN);
  const toast = useToast();

  useEffect(() => {
    const handleOpen = () => setIsSocketConnected(true);
    const handleClose = () => setIsSocketConnected(false);

    socket.addEventListener('open', handleOpen);
    socket.addEventListener('close', handleClose);

    return () => {
      socket.removeEventListener('open', handleOpen);
      socket.removeEventListener('close', handleClose);
    };
  }, []);

  const handleStartReadings = () => {
    socket.send('start_readings');
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
    toast({
      title: 'Test ended',
      status: 'info',
      duration: 2000,
    });
  };

  return (
    <HStack spacing={4}>
      <Button
        colorScheme="green"
        onClick={handleStartReadings}
        isDisabled={!isSocketConnected}
      >
        Start
      </Button>
      <Button
        colorScheme="orange"
        onClick={handleIgnite}
        isDisabled={!isSocketConnected}
      >
        Ignite
      </Button>
      <Button
        colorScheme="red"
        onClick={handleEndTest}
        isDisabled={!isSocketConnected}
      >
        End
      </Button>
    </HStack>
  );
};

export default Controls;