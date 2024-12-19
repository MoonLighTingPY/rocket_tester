import { socket } from '../websocket';

const Controls = () => {
  const handleStartReadings = () => {
    socket.send('start_readings');
  };

  const handleStartTest = () => {
    socket.send('start_test');
  };

  const handleEndTest = () => {
    socket.send('end_test');
  };

  return (
    <div className="controls">
      <button onClick={handleStartReadings}>Start</button>
      <button onClick={handleStartTest}>Ignite</button>
      <button onClick={handleEndTest}>End</button>
    </div>
  );
};

export default Controls;