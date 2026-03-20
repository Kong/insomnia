// export models that define the structure of the data and any related functions such as init, type guards
import * as caCertificate from './ca-certificate';
import * as mcpPayload from './mcp-payload';
import * as mcpRequest from './mcp-request';
import * as mcpResponse from './mcp-response';
import * as settings from './settings';

export const models = {
  caCertificate,
  mcpRequest,
  mcpPayload,
  mcpResponse,
  settings,
} as const;
