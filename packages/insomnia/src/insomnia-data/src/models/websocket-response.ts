import { services } from '~/insomnia-data';

import { database as db } from '../common/database';
import * as requestOperations from './helpers/request-operations';
import * as models from './index';
import type { ResponseHeader } from './response';
import type { BaseModel } from './types';

export const name = 'WebSocket Response';

export const type = 'WebSocketResponse';

export const prefix = 'ws-res';

export const canDuplicate = false;

export const canSync = false;

export interface BaseWebSocketResponse {
  environmentId: string | null;
  statusCode: number;
  statusMessage: string;
  httpVersion: string;
  contentType: string;
  url: string;
  elapsedTime: number;
  headers: ResponseHeader[];
  // Event logs are stored on the filesystem
  eventLogPath: string;
  // Actual timelines are stored on the filesystem
  timelinePath: string;
  error: string;
  requestVersionId: string | null;
  settingStoreCookies: boolean | null;
  settingSendCookies: boolean | null;
}

export type WebSocketResponse = BaseModel & BaseWebSocketResponse;

export const isWebSocketResponse = (model: Pick<BaseModel, 'type'>): model is WebSocketResponse => model.type === type;

export function init(): BaseWebSocketResponse {
  return {
    statusCode: 0,
    statusMessage: '',
    httpVersion: '',
    contentType: '',
    url: '',
    elapsedTime: 0,
    headers: [],
    timelinePath: '',
    eventLogPath: '',
    error: '',
    requestVersionId: null,
    settingStoreCookies: null,
    settingSendCookies: null,
    environmentId: null,
  };
}

export function migrate(doc: WebSocketResponse) {
  return doc;
}

export function getById(id: string) {
  return db.findOne<WebSocketResponse>(type, { _id: id });
}

export function findByParentId(parentId: string) {
  return db.find<WebSocketResponse>(type, { parentId: parentId });
}

export async function all() {
  return db.find<WebSocketResponse>(type);
}

export async function create(patch: Partial<WebSocketResponse> = {}, maxResponses = 20) {
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

  if ((await services.settings.get()).filterResponsesByEnv && 'environmentId' in patch) {
    query.environmentId = patch.environmentId;
  }

  // Delete all other responses before creating the new one
  const responsesToShow = Math.max(1, maxResponses);

  const allResponses = await db.find<WebSocketResponse>(type, query, { modified: -1 }, responsesToShow);

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

export async function getLatestForRequestId(requestId: string, environmentId: string | null) {
  // Filter responses by environment if setting is enabled

  const shouldFilter = (await services.settings.get()).filterResponsesByEnv;

  const response = await db.findOne<WebSocketResponse>(
    type,
    {
      parentId: requestId,
      ...(shouldFilter ? { environmentId } : {}),
    },
    { modified: -1 },
  );
  return response;
}
