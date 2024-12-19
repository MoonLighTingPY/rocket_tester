import React from 'react';
import { socket } from '../websocket';

const StartButton = () => {
  const handleStart = () => {
    socket.send(JSON.stringify({ command: 'start' }));
  };

  return <button onClick={handleStart}>Start</button>;
};

export default StartButton;