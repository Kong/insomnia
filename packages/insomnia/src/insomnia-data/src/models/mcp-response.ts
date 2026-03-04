import type { ResponseHeader } from '~/models/response';
import type { BaseModel } from '~/models/types';

import { type McpTransportType, TRANSPORT_TYPES } from './mcp-request';

export const name = 'Mcp Response';
export const type = 'McpResponse';
export const prefix = 'mcp-response';
export const canDuplicate = false;
export const canSync = false;

export interface BaseMcpResponse {
  environmentId: string | null;
  // Only for STDIO transport
  status: string;
  // Only for HTTP transport
  statusCode: number;
  statusMessage: string;
  url: string;
  elapsedTime: number;
  headers: ResponseHeader[];
  // Event logs are stored on the filesystem
  eventLogPath: string;
  // Actual timelines are stored on the filesystem
  timelinePath: string;
  error: string;
  errorType?: string;
  requestVersionId: string | null;
  transportType: McpTransportType;
}

export type McpResponse = BaseModel & BaseMcpResponse;

export const isMcpResponse = (model: Pick<BaseModel, 'type'>): model is McpResponse => model.type === type;

export function init(): BaseMcpResponse {
  return {
    url: '',
    elapsedTime: 0,
    headers: [],
    timelinePath: '',
    eventLogPath: '',
    error: '',
    errorType: '',
    status: '',
    statusCode: 0,
    statusMessage: '',
    requestVersionId: null,
    environmentId: null,
    transportType: TRANSPORT_TYPES.HTTP,
  };
}
