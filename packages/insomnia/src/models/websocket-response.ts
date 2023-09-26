import fs from 'fs';

import { database as db, Query } from '../common/database';
import * as requestOperations from './helpers/request-operations';
import type { BaseModel } from './index';
import * as models from './index';
import { ResponseHeader } from './response';

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

export const isWebSocketResponse = (model: Pick<BaseModel, 'type'>): model is WebSocketResponse => (
  model.type === type
);

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

export function migrate(doc: Response) {
  return doc;
}

export function hookDatabaseInit(consoleLog: typeof console.log = console.log) {
  consoleLog('[db] Init websocket-responses DB');
}

export function hookRemove(doc: WebSocketResponse, consoleLog: typeof console.log = console.log) {
  fs.unlink(doc.eventLogPath, () => {
    consoleLog(`[response] Delete body ${doc.eventLogPath}`);
  });

  fs.unlink(doc.timelinePath, () => {
    consoleLog(`[response] Delete timeline ${doc.timelinePath}`);
  });
}

export function getById(id: string) {
  return db.get<WebSocketResponse>(type, id);
}

export function findByParentId(parentId: string) {
  return db.find<WebSocketResponse>(type, { parentId: parentId });
}

export async function all() {
  return db.all<WebSocketResponse>(type);
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

  // Also delete legacy responses here or else the user will be confused as to
  // why some responses are still showing in the UI.
  await db.removeWhere(type, query);
}

export function remove(response: WebSocketResponse) {
  return db.remove(response);
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

  if (
    (await models.settings.get()).filterResponsesByEnv &&
    patch.hasOwnProperty('environmentId')
  ) {
    query.environmentId = patch.environmentId;
  }

  // Delete all other responses before creating the new one
  const allResponses = await db.findMostRecentlyModified<WebSocketResponse>(type, query, Math.max(1, maxResponses));
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

async function _findRecentForRequest(
  requestId: string,
  environmentId: string | null,
  limit: number,
) {
  const query: Query = {
    parentId: requestId,
  };

  // Filter responses by environment if setting is enabled
  if ((await models.settings.get()).filterResponsesByEnv) {
    query.environmentId = environmentId;
  }

  return db.findMostRecentlyModified<WebSocketResponse>(type, query, limit);
}

export async function getLatestForRequest(
  requestId: string,
  environmentId: string | null,
) {
  const responses = await _findRecentForRequest(requestId, environmentId, 1);
  const response = responses[0] as WebSocketResponse | null | undefined;
  return response || null;
}

export function getLatestByParentId(parentId: string) {
  return db.getMostRecentlyModified<WebSocketResponse>(type, {
    parentId,
  });
}
