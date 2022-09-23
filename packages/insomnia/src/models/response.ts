import fs from 'fs';
import { Readable } from 'stream';
import zlib from 'zlib';

import { database as db, Query } from '../common/database';
import type { ResponseTimelineEntry } from '../main/network/libcurl-promise';
import * as requestOperations from '../models/helpers/request-operations';
import type { BaseModel } from './index';
import * as models from './index';

export const name = 'Response';

export const type = 'Response';

export const prefix = 'res';

export const canDuplicate = false;

export const canSync = false;

export interface ResponseHeader {
  name: string;
  value: string;
}

type Compression = 'zip' | null | '__NEEDS_MIGRATION__' | undefined;

export interface BaseResponse {
  environmentId: string | null;
  statusCode: number;
  statusMessage: string;
  httpVersion: string;
  contentType: string;
  url: string;
  bytesRead: number;
  bytesContent: number;
  elapsedTime: number;
  headers: ResponseHeader[];
  bodyPath: string;
  // Actual bodies are stored on the filesystem
  timelinePath: string;
  // Actual timelines are stored on the filesystem
  bodyCompression: Compression;
  error: string;
  requestVersionId: string | null;
  // Things from the request
  settingStoreCookies: boolean | null;
  settingSendCookies: boolean | null;
}

export type Response = BaseModel & BaseResponse;

export const isResponse = (model: Pick<BaseModel, 'type'>): model is Response => (
  model.type === type
);

export function init(): BaseResponse {
  return {
    statusCode: 0,
    statusMessage: '',
    httpVersion: '',
    contentType: '',
    url: '',
    bytesRead: 0,
    // -1 means that it was legacy and this property didn't exist yet
    bytesContent: -1,
    elapsedTime: 0,
    headers: [],
    // Actual timelines are stored on the filesystem
    timelinePath: '',
    // Actual bodies are stored on the filesystem
    bodyPath: '',
    // For legacy bodies
    bodyCompression: '__NEEDS_MIGRATION__',
    error: '',
    // Things from the request
    requestVersionId: null,
    settingStoreCookies: null,
    settingSendCookies: null,
    // Responses sent before environment filtering will have a special value
    // so they don't show up at all when filtering is on.
    environmentId: '__LEGACY__',
  };
}

export async function migrate(doc: Response) {
  doc = await migrateBodyCompression(doc);
  return doc;
}

export function hookDatabaseInit(consoleLog: typeof console.log = console.log) {
  consoleLog('[db] Init responses DB');
}

export function hookRemove(doc: Response, consoleLog: typeof console.log = console.log) {
  fs.unlink(doc.bodyPath, () => {
    consoleLog(`[response] Delete body ${doc.bodyPath}`);
  });
  fs.unlink(doc.timelinePath, () => {
    consoleLog(`[response] Delete timeline ${doc.timelinePath}`);
  });
}

export function getById(id: string) {
  return db.get<Response>(type, id);
}

export async function all() {
  return db.all<Response>(type);
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

export function remove(response: Response) {
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

  return db.findMostRecentlyModified<Response>(type, query, limit);
}

export async function getLatestForRequest(
  requestId: string,
  environmentId: string | null,
) {
  const responses = await _findRecentForRequest(requestId, environmentId, 1);
  const response = responses[0] as Response | null | undefined;
  return response || null;
}

export async function create(patch: Record<string, any> = {}, maxResponses = 20) {
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
  const allResponses = await db.findMostRecentlyModified<Response>(type, query, Math.max(1, maxResponses));
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
  return db.getMostRecentlyModified<Response>(type, {
    parentId,
  });
}

export function getBodyStream<T extends Response, TFail extends Readable>(
  response: T,
  readFailureValue?: TFail | null,
) {
  return getBodyStreamFromPath(response.bodyPath || '', response.bodyCompression, readFailureValue);
}

export const getBodyBuffer = <TFail = null>(
  response?: { bodyPath?: string; bodyCompression?: Compression },
  readFailureValue?: TFail | null,
) => getBodyBufferFromPath(
    response?.bodyPath || '',
    response?.bodyCompression || null,
    readFailureValue,
  );

export function getTimeline(response: Response, showBody?: boolean) {
  const { timelinePath, bodyPath } = response;

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
        value: fs.readFileSync(bodyPath).toString(),
      },
    ] : [];
    const output = [...timeline, ...body];
    return output;
  } catch (err) {
    console.warn('Failed to read response body', err.message);
    return [];
  }
}

function getBodyStreamFromPath<TFail extends Readable>(
  bodyPath: string,
  compression: Compression,
  readFailureValue?: TFail | null,
): Readable | null | TFail {
  // No body, so return empty Buffer
  if (!bodyPath) {
    return null;
  }

  try {
    fs.statSync(bodyPath);
  } catch (err) {
    console.warn('Failed to read response body', err.message);
    return readFailureValue === undefined ? null : readFailureValue;
  }

  const readStream = fs.createReadStream(bodyPath);

  if (compression === 'zip') {
    return readStream.pipe(zlib.createGunzip());
  } else {
    return readStream;
  }
}

function getBodyBufferFromPath<T>(
  bodyPath: string,
  compression: Compression,
  readFailureValue?: T | null,
) {
  // No body, so return empty Buffer
  if (!bodyPath) {
    return Buffer.alloc(0);
  }

  try {
    const rawBuffer = fs.readFileSync(bodyPath);

    if (compression === 'zip') {
      return zlib.gunzipSync(rawBuffer);
    } else {
      return rawBuffer;
    }
  } catch (err) {
    console.warn('Failed to read response body', err.message);
    return readFailureValue === undefined ? null : readFailureValue;
  }
}

function migrateBodyCompression(doc: Response) {
  if (doc.bodyCompression === '__NEEDS_MIGRATION__') {
    doc.bodyCompression = 'zip';
  }

  return doc;
}
