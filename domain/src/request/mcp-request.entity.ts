import type { Root } from '@modelcontextprotocol/sdk/types.js';

import type { EnvironmentKvPairData } from '../environment/environment.entity';
import type { Entity } from '../shared/entity';
import type { RequestAuthentication, RequestHeader } from './request-shared.entity';

export const MCP_TRANSPORT_TYPES = {
  STDIO: 'stdio',
  HTTP: 'streamable-http',
} as const;
export type McpTransportType = (typeof MCP_TRANSPORT_TYPES)[keyof typeof MCP_TRANSPORT_TYPES];

export interface McpRequest extends Omit<Entity, 'isPrivate'> {
  type: 'McpRequest';
  // Neither `name` nor `isPrivate` is declared in insomnia-data's BaseMcpRequest.init(), and
  // neither is in its optionalKeys - so initModel()'s field-pruning strips both on every write
  // (create, update, and the raw update() save() uses here). Both are optional/unreliable for
  // this variant specifically; this is a pre-existing insomnia-data characteristic, not something
  // to paper over with a type that promises more than the runtime actually delivers.
  name?: string;
  isPrivate?: boolean;
  url: string;
  transportType: McpTransportType;
  description: string;
  headers: RequestHeader[];
  authentication: RequestAuthentication | {};
  env: EnvironmentKvPairData[];
  mcpStdioAccess: boolean;
  roots: Root[];
  subscribeResources: string[];
  connected: boolean;
  // See: https://nodejs.org/api/tls.html#tlsconnectoptions-callback
  sslValidation: boolean;
  disableUserAgentHeader?: boolean;
}
