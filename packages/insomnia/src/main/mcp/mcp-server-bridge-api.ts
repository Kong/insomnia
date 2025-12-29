export interface McpServerBridgeAPI {
  start: (port?: number) => Promise<any>;
  stop: () => Promise<any>;
  getStatus: () => Promise<any>;
  restart: (port?: number) => Promise<any>;
}
