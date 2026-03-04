// database
export * from './database';

// model types — flat re-exports for convenient consumer access, only export types that are needed outside of this package
export type { CaCertificate } from './models/ca-certificate';
export type { McpRequest, McpTransportType, McpServerPrimitiveTypes } from './models/mcp-request';
export type { McpPayload } from './models/mcp-payload';
export type { McpResponse } from './models/mcp-response';

// models - export models that define the structure of the data and any related functions such as init, type guards
import * as caCertificate from './models/ca-certificate';
import * as mcpPayload from './models/mcp-payload';
import * as mcpRequest from './models/mcp-request';
import * as mcpResponse from './models/mcp-response';

export const models = {
  caCertificate,
  mcpRequest,
  mcpPayload,
  mcpResponse,
} as const;

// services
export { services, initServices, type Services } from './services';
export { type ModelMap, type BaseServices, type AllTypes } from './services/base';
