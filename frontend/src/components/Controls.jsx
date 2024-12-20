// src/components/Controls.jsx
import { useContext, useState, useEffect } from 'react';
import { socket } from '../websocket';
import DataContext from '../hooks/DataContext';

const Controls = () => {
  const { clearTestData, handleStartTest } = useContext(DataContext);
  const [isSocketConnected, setIsSocketConnected] = useState(socket.readyState === WebSocket.OPEN);

  useEffect(() => {
    const handleOpen = () => {
      setIsSocketConnected(true);
    };

    const handleClose = () => {
      setIsSocketConnected(false);
    };

    socket.addEventListener('open', handleOpen);
    socket.addEventListener('close', handleClose);

    // Clean up event listeners on unmount
    return () => {
      socket.removeEventListener('open', handleOpen);
      socket.removeEventListener('close', handleClose);
    };
  }, []);

  const handleStartReadings = () => {
    socket.send('start_readings');
    clearTestData();
  };

  const handleIgnite = () => {
    socket.send('start_test');
    handleStartTest();
  };

  const handleEndTest = () => {
    socket.send('end_test');
  };

  return (
    <div className="controls">
      <button onClick={handleStartReadings} disabled={!isSocketConnected}>
        Start
      </button>
      <button onClick={handleIgnite} disabled={!isSocketConnected}>
        Ignite
      </button>
      <button onClick={handleEndTest} disabled={!isSocketConnected}>
        End
      </button>
    </div>
  );
};

export default Controls;