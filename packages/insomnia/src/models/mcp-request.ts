import type { Root } from '@modelcontextprotocol/sdk/types.js';

import { databaseSchema } from '~/models/schema';
import { invariant } from '~/utils/invariant';

import { database as db } from '../common/database';
import { type EnvironmentKvPairData } from './environment';
import type { BaseModel } from './index';
import type { RequestAuthentication, RequestHeader } from './request';

const type = databaseSchema.McpRequest.type;

export const TRANSPORT_TYPES = {
  STDIO: 'stdio',
  HTTP: 'streamable-http',
} as const;
export type TransportType = (typeof TRANSPORT_TYPES)[keyof typeof TRANSPORT_TYPES];

export interface BaseMcpRequest {
  url: string;
  transportType: TransportType;
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
}
export type McpServerPrimitiveTypes = 'tools' | 'resources' | 'prompts' | 'resourceTemplates';

export const MCP_TRANSPORT_TYPES: TransportType[] = [TRANSPORT_TYPES.HTTP, TRANSPORT_TYPES.STDIO];

export type McpRequest = BaseModel & BaseMcpRequest & { type: typeof type };

export const isMcpRequest = (model: Pick<BaseModel, 'type'>): model is McpRequest => model.type === type;

export const isMcpRequestId = (id?: string | null) => id?.startsWith(`${databaseSchema.McpRequest.prefix}_`);

export function create(patch: Partial<McpRequest> = {}) {
  if (!patch.parentId) {
    throw new Error('New GrpcRequest missing `parentId`');
  }

  return db.docCreate<McpRequest>(type, patch);
}

export function remove(obj: McpRequest) {
  return db.remove(obj);
}

export function all() {
  return db.find<McpRequest>(type);
}

export function getByParentId(parentId: string) {
  return db.findOne<McpRequest>(type, { parentId });
}

export function getById(id: string) {
  return db.findOne<McpRequest>(type, { _id: id });
}

export function update(request: McpRequest, patch: Partial<McpRequest> = {}) {
  return db.docUpdate<McpRequest>(request, patch);
}

export async function clearResourceSubscriptions(requestId: string) {
  const request = await getById(requestId);
  invariant(request, 'McpRequest not found');
  return update(request, { subscribeResources: [] });
}
