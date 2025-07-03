import fs from 'node:fs';

import { database as db, type Query } from '../common/database';
import * as requestOperations from './helpers/request-operations';
import type { BaseModel } from './index';
import * as models from './index';

export const name = 'SocketIO Response';

export const type = 'SocketIOResponse';

export const prefix = 'socketIO-res';

export const canDuplicate = false;

export const canSync = false;

export interface BaseSocketIOResponse {
  // Event logs are stored on the filesystem
  eventLogPath: string;
  // Actual timelines are stored on the filesystem
  timelinePath: string;
  requestVersionId: string | null;
  environmentId: string | null;
  elapsedTime: number;
  error: string;
  url: string;
}

export type SocketIOResponse = BaseModel & BaseSocketIOResponse;

export const isSocketIOResponse = (model: Pick<BaseModel, 'type'>): model is SocketIOResponse => model.type === type;

export function init(): BaseSocketIOResponse {
  return {
    timelinePath: '',
    eventLogPath: '',
    requestVersionId: null,
    environmentId: null,
    elapsedTime: 0,
    error: '',
    url: '',
  };
}

export function migrate(doc: SocketIOResponse) {
  return doc;
}

export function update(doc: SocketIOResponse, patch: Partial<SocketIOResponse>) {
  return db.docUpdate(doc, patch);
}

export function hookDatabaseInit(consoleLog: typeof console.log = console.log) {
  consoleLog('[db] Init SocketIO-responses DB');
}

export function hookRemove(doc: SocketIOResponse, consoleLog: typeof console.log = console.log) {
  fs.unlink(doc.eventLogPath, () => {
    consoleLog(`[response] Delete body ${doc.eventLogPath}`);
  });

  fs.unlink(doc.timelinePath, () => {
    consoleLog(`[response] Delete timeline ${doc.timelinePath}`);
  });
}

export function getById(id: string) {
  return db.get<SocketIOResponse>(type, id);
}

export function findByParentId(parentId: string) {
  return db.find<SocketIOResponse>(type, { parentId: parentId });
}

export async function all() {
  return db.all<SocketIOResponse>(type);
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

export function remove(response: SocketIOResponse) {
  return db.remove(response);
}

export async function create(patch: Partial<SocketIOResponse> = {}, maxResponses = 20) {
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
  const allResponses = await db.findMostRecentlyModified<SocketIOResponse>(type, query, Math.max(1, maxResponses));
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

async function _findRecentForRequest(requestId: string, environmentId: string | null, limit: number) {
  const query: Query<SocketIOResponse> = {
    parentId: requestId,
  };

  // Filter responses by environment if setting is enabled
  if ((await models.settings.get()).filterResponsesByEnv) {
    query.environmentId = environmentId;
  }

  return db.findMostRecentlyModified<SocketIOResponse>(type, query, limit);
}

export async function getLatestForRequest(requestId: string, environmentId: string | null) {
  const responses = await _findRecentForRequest(requestId, environmentId, 1);
  const response = responses[0] as SocketIOResponse | null | undefined;
  return response || null;
}

export function getLatestByParentId(parentId: string) {
  return db.getMostRecentlyModified<SocketIOResponse>(type, {
    parentId,
  });
}
