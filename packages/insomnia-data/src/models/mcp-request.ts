import type { Root } from '@modelcontextprotocol/sdk/types.js';

import type { BaseModel } from './base-types';
import type { EnvironmentKvPairData } from './environment';
import type { RequestAuthentication, RequestHeader } from './request';

export const name = 'MCP Request';
export const type = 'McpRequest';
export const prefix = 'mcp-req';
export const canDuplicate = true;
export const canSync = true;

export const TRANSPORT_TYPES = {
  STDIO: 'stdio',
  HTTP: 'streamable-http',
} as const;
export type McpTransportType = (typeof TRANSPORT_TYPES)[keyof typeof TRANSPORT_TYPES];

export interface BaseMcpRequest {
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
export type McpServerPrimitiveTypes = 'tools' | 'resources' | 'prompts' | 'resourceTemplates';

export const MCP_TRANSPORT_TYPES: McpTransportType[] = [TRANSPORT_TYPES.HTTP, TRANSPORT_TYPES.STDIO];

export type McpRequest = BaseModel & BaseMcpRequest & { type: typeof type };

export const isMcpRequest = (model: Pick<BaseModel, 'type'>): model is McpRequest => model.type === type;

export const isMcpRequestId = (id?: string | null) => id?.startsWith(`${prefix}_`);

export function init(): BaseMcpRequest {
  return {
    url: '',
    transportType: TRANSPORT_TYPES.HTTP,
    description: '',
    headers: [],
    authentication: {},
    env: [],
    mcpStdioAccess: false,
    roots: [],
    subscribeResources: [],
    connected: false,
    sslValidation: true,
  };
}

export const optionalKeys: (keyof BaseMcpRequest)[] = ['disableUserAgentHeader'];
