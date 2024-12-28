const socket = new WebSocket(`ws://esp32-rockettester.local:81/ws`);

socket.onopen = () => {
  console.log('WebSocket connection established');
};

socket.onerror = (error) => {
  console.error('WebSocket error:', error);
};

socket.onclose = () => {
  console.log('WebSocket connection closed');
};

//console log every messsage
// socket.addEventListener('message', (event) => {
//   console.log('Message from server ', event.data);
// });

export { socket };