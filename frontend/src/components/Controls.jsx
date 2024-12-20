// src/components/Controls.jsx
import { useContext, useState, useEffect } from 'react';
import { socket } from '../websocket';
import DataContext from '../hooks/DataContext';

const Controls = () => {
  const { clearTestData } = useContext(DataContext);
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

  const handleStartTest = () => {
    socket.send('start_test');
  };

  const handleEndTest = () => {
    socket.send('end_test');
  };

  return (
    <div className="controls">
      <button onClick={handleStartReadings} disabled={!isSocketConnected}>
        Start
      </button>
      <button onClick={handleStartTest} disabled={!isSocketConnected}>
        Ignite
      </button>
      <button onClick={handleEndTest} disabled={!isSocketConnected}>
        End
      </button>
    </div>
  );
};

export default Controls;