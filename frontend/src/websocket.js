// Determine if we're in development mode
const isDev = import.meta.env.DEV || process.env.NODE_ENV === 'development';

// Use hardcoded ESP32 IP in development, otherwise use window.location.hostname
const host = isDev ? '169.254.1.1' : window.location.hostname;
const socket = new WebSocket(`ws://${host}:81`);

socket.onopen = () => {
  console.log('WebSocket connection established');
};

socket.onerror = (error) => {
  console.error('WebSocket error:', error);
};

socket.onclose = () => {
  console.log('WebSocket connection closed');
};

// Console log every messsage for test, remove in prod as it slows the client (buy a better computer nigga)
socket.addEventListener('message', (event) => {
  console.log('Message from server ', event.data);
});

export { socket };