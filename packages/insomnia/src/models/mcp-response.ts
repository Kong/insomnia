import fs from 'node:fs';

import { database as db } from '../common/database';
import * as requestOperations from './helpers/request-operations';
import type { BaseModel } from './index';
import * as models from './index';
import { TRANSPORT_TYPES, type TransportType } from './mcp-request';
import type { ResponseHeader } from './response';

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
  transportType: TransportType;
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

export function migrate(doc: McpResponse) {
  return doc;
}

export function getById(id: string) {
  return db.findOne<McpResponse>(type, { _id: id });
}

export function findByParentId(parentId: string) {
  return db.find<McpResponse>(type, { parentId: parentId });
}

export async function all() {
  return db.find<McpResponse>(type);
}

export async function removeForRequest(parentId: string, environmentId?: string | null) {
  const settings = await models.settings.get();
  const query: Record<string, any> = {
    parentId,
  };

  // Only add if not undefined. null is not the same as undefined
  //  null: find responses sent from base environment
  //  undefined: find all responses
  if (environmentId !== undefined && settings.filterResponsesByEnv) {
    query.environmentId = environmentId;
  }
  const toDelete = await db.find<McpResponse>(type, query);
  for (const doc of toDelete) {
    fs.promises.unlink(doc.eventLogPath);
    fs.promises.unlink(doc.timelinePath);
  }
  // Also delete legacy responses here or else the user will be confused as to
  // why some responses are still showing in the UI.
  await db.removeWhere(type, query);
}

export function remove(response: McpResponse) {
  fs.promises.unlink(response.eventLogPath);
  fs.promises.unlink(response.timelinePath);
  return db.remove(response);
}

export async function create(patch: Partial<McpResponse> = {}, maxResponses = 20) {
  if (!patch.parentId) {
    throw new Error('New Response missing `parentId`');
  }

  const { parentId } = patch;
  // Create request version snapshot
  const request = await requestOperations.getById(parentId);
  const requestVersion = request ? await models.requestVersion.create(request) : null;
  patch.requestVersionId = requestVersion ? requestVersion._id : null;
  // Filter responses by environment if setting is enabled
  const query: Record<string, any> = {
    parentId,
  };

  if ((await models.settings.get()).filterResponsesByEnv && 'environmentId' in patch) {
    query.environmentId = patch.environmentId;
  }

  // Delete all other responses before creating the new one
  const responsesToShow = Math.max(1, maxResponses);

  const allResponses = await db.find<McpResponse>(type, query, { modified: -1 }, responsesToShow);

  const recentIds = allResponses.map(r => r._id);
  // Remove all that were in the last query, except the first `maxResponses` IDs
  await db.removeWhere(type, {
    ...query,
    _id: {
      $nin: recentIds,
    },
  });
  // Actually create the new response
  return db.docCreate(type, patch);
}

export async function updateOrCreate(patch: Partial<McpResponse>, maxResponses = 20) {
  const id = patch._id;
  if (!id) {
    throw new Error('Cannot updateOrCreate McpResponse without _id');
  }

  const existing = await getById(id);
  if (existing) {
    return db.docUpdate(existing, patch);
  }

  return create(patch, maxResponses);
}

export async function getLatestForRequestId(requestId: string, environmentId: string | null) {
  // Filter responses by environment if setting is enabled

  const shouldFilter = (await models.settings.get()).filterResponsesByEnv;

  const response = await db.findOne<McpResponse>(
    type,
    {
      parentId: requestId,
      ...(shouldFilter ? { environmentId } : {}),
    },
    { modified: -1 },
  );
  return response;
}
