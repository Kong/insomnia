const doWork = input => {
  // Something cpu-intensive.
  return input * 2;
};
window.bridge.on('new-client', event => {
  const [port] = event.ports;
  console.log('opened port to insomnia renderer');
  port.onmessage = event => {
    // The event data can be any serializable object (and the event could even
    // carry other MessagePorts with it!)
    const result = doWork(event.data);
    console.log('got', event.data, result);
    port.postMessage(result);
  };
});
