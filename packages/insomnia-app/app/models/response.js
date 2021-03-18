// @flow
import type { BaseModel } from './index';
import * as models from './index';
import { Readable } from 'stream';

import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import zlib from 'zlib';
import mkdirp from 'mkdirp';
import * as db from '../common/database';
import { getDataDirectory } from '../common/misc';

export const name = 'Response';
export const type = 'Response';
export const prefix = 'res';
export const canDuplicate = false;
export const canSync = false;

export type ResponseHeader = {
  name: string,
  value: string,
};

export type ResponseTimelineEntry = {
  name: string,
  value: string,
};

type BaseResponse = {
  environmentId: string | null,
  statusCode: number,
  statusMessage: string,
  httpVersion: string,
  contentType: string,
  url: string,
  bytesRead: number,
  bytesContent: number,
  elapsedTime: number,
  headers: Array<ResponseHeader>,
  bodyPath: string, // Actual bodies are stored on the filesystem
  timelinePath: string, // Actual timelines are stored on the filesystem
  bodyCompression: 'zip' | null | '__NEEDS_MIGRATION__',
  error: string,
  requestVersionId: string | null,

  // Things from the request
  settingStoreCookies: boolean | null,
  settingSendCookies: boolean | null,
};

export type Response = BaseModel & BaseResponse;

export function init(): BaseResponse {
  return {
    statusCode: 0,
    statusMessage: '',
    httpVersion: '',
    contentType: '',
    url: '',
    bytesRead: 0,
    bytesContent: -1, // -1 means that it was legacy and this property didn't exist yet
    elapsedTime: 0,
    headers: [],
    timelinePath: '', // Actual timelines are stored on the filesystem
    bodyPath: '', // Actual bodies are stored on the filesystem
    bodyCompression: '__NEEDS_MIGRATION__', // For legacy bodies
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

export async function migrate(doc: Object) {
  doc = await migrateBodyToFileSystem(doc);
  doc = await migrateBodyCompression(doc);
  doc = await migrateTimelineToFileSystem(doc);
  return doc;
}

export function hookDatabaseInit(consoleLog: () => void = console.log) {
  consoleLog('[db] Init responses DB');
  process.nextTick(async () => {
    await models.response.cleanDeletedResponses();
  });
}

export function hookRemove(doc: Response, consoleLog: () => void = console.log) {
  fs.unlink(doc.bodyPath, () => {
    consoleLog(`[response] Delete body ${doc.bodyPath}`);
  });
  fs.unlink(doc.timelinePath, () => {
    consoleLog(`[response] Delete timeline ${doc.timelinePath}`);
  });
}

export function getById(id: string) {
  return db.get(type, id);
}

export async function all(): Promise<Array<Response>> {
  return db.all(type);
}

export async function removeForRequest(parentId: string, environmentId?: string | null) {
  const settings = await models.settings.getOrCreate();
  const query: Object = {
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
): Promise<Array<Response>> {
  const query: Object = {
    parentId: requestId,
  };

  // Filter responses by environment if setting is enabled
  if ((await models.settings.getOrCreate()).filterResponsesByEnv) {
    query.environmentId = environmentId;
  }

  return db.findMostRecentlyModified(type, query, limit);
}

export async function getLatestForRequest(
  requestId: string,
  environmentId: string | null,
): Promise<Response | null> {
  const responses = await _findRecentForRequest(requestId, environmentId, 1);
  const response = (responses[0]: ?Response);
  return response || null;
}

export async function create(patch: Object = {}, maxResponses: number = 20) {
  if (!patch.parentId) {
    throw new Error('New Response missing `parentId`');
  }

  const { parentId } = patch;

  // Create request version snapshot
  const request = await models.request.getById(parentId);
  const requestVersion = request ? await models.requestVersion.create(request) : null;
  patch.requestVersionId = requestVersion ? requestVersion._id : null;

  // Filter responses by environment if setting is enabled
  const query: Object = { parentId };
  if (
    (await models.settings.getOrCreate()).filterResponsesByEnv &&
    patch.hasOwnProperty('environmentId')
  ) {
    query.environmentId = patch.environmentId;
  }

  // Delete all other responses before creating the new one
  const allResponses = await db.findMostRecentlyModified(type, query, Math.max(1, maxResponses));
  const recentIds = allResponses.map(r => r._id);

  // Remove all that were in the last query, except the first `maxResponses` IDs
  await db.removeWhere(type, { ...query, _id: { $nin: recentIds } });

  // Actually create the new response
  return db.docCreate(type, patch);
}

export function getLatestByParentId(parentId: string) {
  return db.getMostRecentlyModified(type, { parentId });
}

export function getBodyStream<T>(response: Object, readFailureValue: ?T): Readable | null | T {
  return getBodyStreamFromPath(response.bodyPath || '', response.bodyCompression, readFailureValue);
}

export function getBodyBuffer<T>(response: Object, readFailureValue: ?T): Buffer | T | null {
  return getBodyBufferFromPath(response.bodyPath || '', response.bodyCompression, readFailureValue);
}

export function getTimeline(response: Object): Array<ResponseTimelineEntry> {
  return getTimelineFromPath(response.timelinePath || '');
}

function getBodyStreamFromPath<T>(
  bodyPath: string,
  compression: string | null,
  readFailureValue: ?T,
): Readable | null | T {
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
  compression: string | null,
  readFailureValue: ?T,
): Buffer | T | null {
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

function getTimelineFromPath(timelinePath: string): Array<ResponseTimelineEntry> {
  // No body, so return empty Buffer
  if (!timelinePath) {
    return [];
  }

  try {
    const rawBuffer = fs.readFileSync(timelinePath);
    return JSON.parse(rawBuffer.toString());
  } catch (err) {
    console.warn('Failed to read response body', err.message);
    return [];
  }
}

async function migrateBodyToFileSystem(doc: Object) {
  if (doc.hasOwnProperty('body') && doc._id && !doc.bodyPath) {
    const bodyBuffer = Buffer.from(doc.body, doc.encoding || 'utf8');
    const dir = path.join(getDataDirectory(), 'responses');

    mkdirp.sync(dir);

    const hash = crypto
      .createHash('md5')
      .update(bodyBuffer || '')
      .digest('hex');
    const bodyPath = path.join(dir, `${hash}.zip`);

    try {
      const buff = bodyBuffer || Buffer.from('');
      fs.writeFileSync(bodyPath, buff);
    } catch (err) {
      console.warn('Failed to write response body to file', err.message);
    }

    return db.docUpdate(doc, { bodyPath, bodyCompression: null });
  } else {
    return doc;
  }
}

function migrateBodyCompression(doc: Object) {
  if (doc.bodyCompression === '__NEEDS_MIGRATION__') {
    doc.bodyCompression = 'zip';
  }

  return doc;
}

async function migrateTimelineToFileSystem(doc: Object) {
  if (doc.hasOwnProperty('timeline') && doc._id && !doc.timelinePath) {
    const dir = path.join(getDataDirectory(), 'responses');

    mkdirp.sync(dir);
    const timelineStr = JSON.stringify(doc.timeline, null, '\t');
    const fsPath = doc.bodyPath + '.timeline';

    try {
      fs.writeFileSync(fsPath, timelineStr);
    } catch (err) {
      console.warn('Failed to write response body to file', err.message);
    }

    return db.docUpdate(doc, { timelinePath: fsPath });
  } else {
    return doc;
  }
}

export async function cleanDeletedResponses() {
  const responsesDir = path.join(getDataDirectory(), 'responses');
  mkdirp.sync(responsesDir);

  const files = fs.readdirSync(responsesDir);
  if (files.length === 0) {
    return;
  }

  const whitelistFiles = [];
  for (const r of await db.all(type)) {
    whitelistFiles.push(r.bodyPath.slice(responsesDir.length + 1));
    whitelistFiles.push(r.timelinePath.slice(responsesDir.length + 1));
  }

  for (const filePath of files) {
    if (whitelistFiles.indexOf(filePath) >= 0) {
      continue;
    }

    try {
      fs.unlinkSync(path.join(responsesDir, filePath));
    } catch (err) {
      // Just keep going, doesn't matter
    }
  }
}
