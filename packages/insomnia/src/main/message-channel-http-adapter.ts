/**
 * @typedef {Object} SerializableRequest
 * @property {string} url
 * @property {string} method
 * @property {Record<string, string>} headers
 */

/**
 * @typedef {Object} SerializableResponse
 * @property {number} status
 * @property {string} statusText
 * @property {Record<string, string>} headers
 */

/**
 * @typedef {Object} ProtocolRequest
 * @property {'request'} type
 * @property {SerializableRequest} request
 * @property {string} requestId
 */

/**
 * @typedef {Object} ProtocolResponse
 * @property {'response'} type
 * @property {SerializableResponse} response
 * @property {string} requestId
 */

/**
 * @typedef {Object} ProtocolBodyChunk
 * @property {'body-chunk'} type
 * @property {Uint8Array} chunk
 * @property {string} requestId
 */

/**
 * @typedef {Object} ProtocolBodyEnd
 * @property {'body-end'} type
 * @property {string} requestId
 */

/**
 * @typedef {Object} ProtocolError
 * @property {'error'} type
 * @property {string} error
 * @property {string} requestId
 */

/**
 * @typedef {ProtocolRequest | ProtocolResponse | ProtocolBodyChunk | ProtocolBodyEnd | ProtocolError} ProtocolMessage
 */

/**
 * @param {Request} request
 * @returns {SerializableRequest}
 */
function serializeRequest(request) {
  return {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
  };
}

/**
 * @param {Response} response
 * @returns {SerializableResponse}
 */
function serializeResponse(response) {
  return {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
  };
}

/**
 * @param {ReadableStream<Uint8Array>|null} body
 * @param {Electron.MessagePortMain} port
 * @param {string} requestId
 */
function streamBodyToPort(body, port, requestId) {
  if (!body) {
    port.postMessage(/** @type {ProtocolBodyEnd} */ ({ type: 'body-end', requestId }));
    return;
  }
  const reader = body.getReader();

  function pump() {
    reader
      .read()
      .then(({ done, value }) => {
        if (done) {
          port.postMessage(/** @type {ProtocolBodyEnd} */ ({ type: 'body-end', requestId }));
          return;
        }
        port.postMessage(
          /** @type {ProtocolBodyChunk} */ ({
            type: 'body-chunk',
            chunk: value,
            requestId,
          }),
        );
        pump();
      })
      .catch(err => {
        port.postMessage(/** @type {ProtocolError} */ ({ type: 'error', error: String(err), requestId }));
      });
  }
  pump();
  port.start(); // Ensure the port is ready to receive messages
}

/**
 * Port event manager for handling multiple concurrent requests
 */
class PortEventManager {
  constructor(port) {
    this.port = port;
    this.activeStreams = new Map();
    this.activeRequests = new Map();
    this.listenerAttached = false;
  }

  ensureListener() {
    if (!this.listenerAttached) {
      this.port.on('message', this.handleMessage.bind(this));
      this.port.start();
      this.listenerAttached = true;
    }
  }

  handleMessage(event) {
    const msg = event.data || event;
    const requestId = msg.requestId;

    if (!requestId) return;

    // Handle stream body messages
    const streamHandler = this.activeStreams.get(requestId);
    if (streamHandler && (msg.type === 'body-chunk' || msg.type === 'body-end' || msg.type === 'error')) {
      streamHandler(msg);
      if (msg.type === 'body-end' || msg.type === 'error') {
        this.activeStreams.delete(requestId);
      }
      return;
    }

    // Handle request/response messages
    const requestHandler = this.activeRequests.get(requestId);
    if (requestHandler && (msg.type === 'response' || msg.type === 'error')) {
      requestHandler(msg);
      this.activeRequests.delete(requestId);
      return;
    }
  }

  registerStreamHandler(requestId, handler) {
    this.ensureListener();
    this.activeStreams.set(requestId, handler);
  }

  registerRequestHandler(requestId, handler) {
    this.ensureListener();
    this.activeRequests.set(requestId, handler);
  }

  cleanup(requestId) {
    this.activeStreams.delete(requestId);
    this.activeRequests.delete(requestId);
  }
}

// Global port managers to reuse event listeners
const portManagers = new WeakMap();

/**
 * @param {Electron.MessagePortMain} port
 * @returns {PortEventManager}
 */
function getPortManager(port) {
  if (!portManagers.has(port)) {
    portManagers.set(port, new PortEventManager(port));
  }
  return portManagers.get(port);
}

/**
 * @param {Electron.MessagePortMain} port
 * @param {string} requestId
 * @returns {ReadableStream<Uint8Array>}
 */
function receiveBodyFromPort(port, requestId) {
  const manager = getPortManager(port);

  /** @type {ReadableStreamDefaultController<Uint8Array>} */
  let controller;

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;

      manager.registerStreamHandler(requestId, msg => {
        if (msg.type === 'body-chunk') {
          try {
            controller.enqueue(new Uint8Array(msg.chunk));
          } catch (err) {
            controller.error(new Error(`Failed to enqueue body chunk: ${err.message}`));
            manager.cleanup(requestId);
          }
        } else if (msg.type === 'body-end') {
          try {
            controller.close();
          } catch (err) {
            controller.error(new Error(`Failed to close stream: ${err.message}`));
          }
          manager.cleanup(requestId);
        } else if (msg.type === 'error') {
          controller.error(new Error(msg.error));
          manager.cleanup(requestId);
        }
      });
    },
  });

  return stream;
}

/**
 * @param {Electron.MessageEvent} event
 * @param {(request: Request) => Promise<Response>} onRequest
 */
export async function handleIncomingRequest(event, onRequest) {
  const port = event.ports[0];
  if (!port) {
    throw new Error('No message port provided');
  }

  const msg = event.data;
  if (msg.type !== 'request') {
    throw new Error(`Unexpected message type: ${msg.type}`);
  }

  const requestId = msg.requestId;
  if (!requestId) {
    throw new Error('No request ID provided');
  }

  try {
    const reqInit = {
      method: msg.request.method,
      headers: msg.request.headers,
    };

    if (reqInit.method !== 'GET' && reqInit.method !== 'HEAD') {
      reqInit.body = receiveBodyFromPort(port, requestId);
      reqInit.duplex = 'half'; // Indicate that the request body is readable
    }

    const request = new Request(msg.request.url, reqInit);

    const response = await onRequest(request);

    port.postMessage(
      /** @type {ProtocolResponse} */ ({
        type: 'response',
        response: serializeResponse(response),
        requestId,
      }),
    );

    streamBodyToPort(response.body, port, requestId);
  } catch (err) {
    port.postMessage(/** @type {ProtocolError} */ ({ type: 'error', error: String(err), requestId }));
  }
}

/**
 * @param {{ postMessage: (msg: ProtocolMessage, ports?: Electron.MessagePortMain[]) => void }} utilityProcess
 * @param {Request} request
 * @param {Electron.MessagePortMain} port
 * @returns {Promise<Response>}
 */
export async function sendRequestViaUtilityProcess(utilityProcess, request, port) {
  return await new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const serializable = serializeRequest(request);
    const manager = getPortManager(port);

    utilityProcess.postMessage(
      /** @type {ProtocolRequest} */ ({
        type: 'request',
        request: serializable,
        requestId,
      }),
    );

    streamBodyToPort(request.body, port, requestId);
    const body = receiveBodyFromPort(port, requestId);

    manager.registerRequestHandler(requestId, msg => {
      if (msg.type === 'response') {
        const response = new Response(body, {
          status: msg.response.status,
          statusText: msg.response.statusText,
          headers: msg.response.headers,
        });
        resolve(response);
      } else if (msg.type === 'error') {
        reject(new Error(msg.error));
      }
    });
  });
}
