import RequestLibBackend from './backends/request-lib';
import ElectronNetBackend from './backends/electron-net';

/**
 * Send a network request through a network backend
 * @param requestConfig NetworkRequestConfig object representing the request
 * @param options any configuration needed for the request
 * @returns {Promise}
 */
export function send (requestConfig, options = {}) {
  const BackendCls = _getBackend(options.backend || 'request-lib');
  const backend = new BackendCls(requestConfig);
  return backend.send();
}

function _getBackend (name) {
  switch (name) {
    case 'request-lib':
      return RequestLibBackend;
    case 'electron-net':
      return ElectronNetBackend;
    default:
      throw new Error(`Unknown request backend: ${name}`);
  }
}
