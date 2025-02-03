const socket = new WebSocket(`ws://169.254.1.1:81`);

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