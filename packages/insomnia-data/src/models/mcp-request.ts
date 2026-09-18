import { z } from 'zod/v4';

import { createModelSchema } from './base-schemas';
import type { BaseModel } from './base-types';
import { EnvironmentKvPairDataSchema } from './environment';
import { AuthenticationSchema, HeadersSchema } from './request';

export const name = 'MCP Request';
export const type = 'McpRequest';
export const prefix = 'mcp-req';
export const canDuplicate = true;
export const canSync = true;

export const TRANSPORT_TYPES = {
  STDIO: 'stdio',
  HTTP: 'streamable-http',
} as const;
const transportTypeEnum = z.enum([TRANSPORT_TYPES.STDIO, TRANSPORT_TYPES.HTTP]);
export type McpTransportType = z.infer<typeof transportTypeEnum>;

export const rootSchema = z.object({
  name: z.string().optional(),
  uri: z.string().optional().default(''),
});
export type Root = z.infer<typeof rootSchema>;

export const baseMcpRequestSettingsSchema = z.object({
  // settings
  mcpStdioAccess: z.boolean().optional().default(false),
  connected: z.boolean().optional().default(false),
  subscribeResources: z.array(z.string()).optional().default([]),
  // See: https://nodejs.org/api/tls.html#tlsconnectoptions-callback
  sslValidation: z.boolean().optional().default(true),
  disableUserAgentHeader: z.boolean().optional(),
});
export const baseMcpRequestSchema = z.object({
  url: z.string().optional().default(''),
  description: z.string().optional().default(''),
  transportType: transportTypeEnum.optional().default(TRANSPORT_TYPES.HTTP),
  headers: HeadersSchema.optional().default([]),
  authentication: AuthenticationSchema.optional().default({}),
  env: z.array(EnvironmentKvPairDataSchema).optional().default([]),
  roots: z.array(rootSchema).optional().default([]),
});
export const baseMcpRequestWithSettingsSchema = z.object({
  ...baseMcpRequestSchema.shape,
  ...baseMcpRequestSettingsSchema.shape,
});
export type BaseMcpRequest = z.infer<typeof baseMcpRequestWithSettingsSchema>;

export type McpServerPrimitiveTypes = 'tools' | 'resources' | 'prompts' | 'resourceTemplates';

export const MCP_TRANSPORT_TYPES: McpTransportType[] = [TRANSPORT_TYPES.HTTP, TRANSPORT_TYPES.STDIO];

export const schema = createModelSchema(type, prefix).extend(baseMcpRequestWithSettingsSchema.shape);
export type McpRequest = z.infer<typeof schema>;

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
