import fs from 'fs';

import { database as db, Query } from '../common/database';
import type { ResponseTimelineEntry } from '../main/network/libcurl-promise';
import * as requestOperations from './helpers/request-operations';
import type { BaseModel } from './index';
import * as models from './index';

export const name = 'WebSocket Response';

export const type = 'WebSocketResponse';

export const prefix = 'ws-res';

export const canDuplicate = false;

export const canSync = false;

export interface WebSocketResponseHeader {
  name: string;
  value: string;
}

export interface BaseWebSocketResponse {
  environmentId: string | null;
  statusCode: number;
  statusMessage: string;
  httpVersion: string;
  contentType: string;
  url: string;
  elapsedTime: number;
  headers: WebSocketResponseHeader[];
  // Event logs are stored on the filesystem
  eventLogPath: string;
  // Actual timelines are stored on the filesystem
  timelinePath: string;
  error: string;
  requestVersionId: string | null;
  // Things from the request
  settingStoreCookies: boolean | null;
  settingSendCookies: boolean | null;
}

export type WebSocketResponse = BaseModel & BaseWebSocketResponse;

export const isResponse = (model: Pick<BaseModel, 'type'>): model is Response => (
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
    // Actual timelines are stored on the filesystem
    timelinePath: '',
    // Actual bodies are stored on the filesystem
    eventLogPath: '',
    error: '',
    requestVersionId: null,
    // Things from the request
    settingStoreCookies: null,
    settingSendCookies: null,
    // Responses sent before environment filtering will have a special value
    // so they don't show up at all when filtering is on.
    environmentId: '__LEGACY__',
  };
}

export async function migrate(doc: Response) {
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

export async function all() {
  return db.all<WebSocketResponse>(type);
}

export async function removeForRequest(parentId: string, environmentId?: string | null) {
  const settings = await models.settings.getOrCreate();
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

async function _findRecentForRequest(
  requestId: string,
  environmentId: string | null,
  limit: number,
) {
  const query: Query = {
    parentId: requestId,
  };

  // Filter responses by environment if setting is enabled
  if ((await models.settings.getOrCreate()).filterResponsesByEnv) {
    query.environmentId = environmentId;
  }

  return db.findMostRecentlyModified<WebSocketResponse>(type, query, limit);
}

export async function getLatestForRequest(
  requestId: string,
  environmentId: string | null,
) {
  const responses = await _findRecentForRequest(requestId, environmentId, 1);
  const response = responses[0];
  return response || null;
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
    (await models.settings.getOrCreate()).filterResponsesByEnv &&
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

export function getLatestByParentId(parentId: string) {
  return db.getMostRecentlyModified<WebSocketResponse>(type, {
    parentId,
  });
}

export function getTimeline(response: WebSocketResponse, showBody?: boolean) {
  const { timelinePath, eventLogPath } = response;

  // No body, so return empty Buffer
  if (!timelinePath) {
    return [];
  }

  try {
    const rawBuffer = fs.readFileSync(timelinePath);
    const timelineString = rawBuffer.toString();
    const timeline = JSON.parse(timelineString) as ResponseTimelineEntry[];
    const body: ResponseTimelineEntry[] = showBody ? [
      {
        name: 'DataOut',
        timestamp: Date.now(),
        value: fs.readFileSync(eventLogPath).toString(),
      },
    ] : [];
    const output = [...timeline, ...body];
    return output;
  } catch (err) {
    console.warn('Failed to read response body', err.message);
    return [];
  }
}
