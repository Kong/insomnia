/* eslint-disable no-undef */
console.log('[router-process] Router worker started');
import { initElectronRouter } from './electron.router.js';
import { handleIncomingRequest } from './message-channel-http-adapter.js';
const { createAppRequestHandler, url } = initElectronRouter();

const requestHandler = createAppRequestHandler();
let communicationPort = null;

process.parentPort.on('message', e => {
  const { type } = e.data;
  if (type === 'init') {
    // Store the communication port from the init message
    communicationPort = e.ports[0];
    console.log('Router process initialized with communication port');
    process.parentPort.postMessage({ type: 'url', url });
  } else if (type === 'request') {
    if (!communicationPort) {
      process.parentPort.postMessage({
        type: 'error',
        error: 'Communication port not set up',
      });
      return;
    }

    // Create a synthetic event with the stored port
    const syntheticEvent = {
      data: e.data,
      ports: [communicationPort],
    };

    handleIncomingRequest(syntheticEvent, requestHandler).catch(err => {
      communicationPort.postMessage({ type: 'error', error: String(err) });
    });
  }
});
