
export default class BaseNetworkBackend {
  constructor (config) {
    if (!config) {
      throw new Error('Network backend initialized without valid config');
    }
  }

  send () {
    throw new Error('Network backend send() not implemented');
  }

  cancel () {
    throw new Error('Network backend cancel() not implemented');
  }
}
