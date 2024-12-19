export const socket = new WebSocket('ws://your-esp32-ip-address');

socket.onopen = () => {
  console.log('WebSocket connection established');
};

socket.onclose = () => {
  console.log('WebSocket connection closed');
};

socket.onerror = (error) => {
  console.error('WebSocket error:', error);
};