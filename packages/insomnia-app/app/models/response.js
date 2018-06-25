// @flow
import type { BaseModel } from './index';
import * as models from './index';
import { Readable } from 'stream';

import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import zlib from 'zlib';
import mkdirp from 'mkdirp';
import * as electron from 'electron';
import { MAX_RESPONSES } from '../common/constants';
import * as db from '../common/database';

export const name = 'Response';
export const type = 'Response';
export const prefix = 'res';
export const canDuplicate = false;

export type ResponseHeader = {
  name: string,
  value: string
};

export type ResponseTimelineEntry = {
  name: string,
  value: string
};

type BaseResponse = {
  statusCode: number,
  statusMessage: string,
  httpVersion: string,
  contentType: string,
  url: string,
  bytesRead: number,
  bytesContent: number,
  elapsedTime: number,
  headers: Array<ResponseHeader>,
  timeline: Array<ResponseTimelineEntry>,
  bodyPath: string, // Actual bodies are stored on the filesystem
  bodyCompression: 'zip' | null | '__NEEDS_MIGRATION__',
  error: string,
  requestVersionId: string | null,

  // Things from the request
  settingStoreCookies: boolean | null,
  settingSendCookies: boolean | null
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
    timeline: [],
    bodyPath: '', // Actual bodies are stored on the filesystem
    bodyCompression: '__NEEDS_MIGRATION__', // For legacy bodies
    error: '',
    requestVersionId: null,

    // Things from the request
    settingStoreCookies: null,
    settingSendCookies: null
  };
}

export async function migrate(doc: Object) {
  doc = await migrateBodyToFileSystem(doc);
  doc = await migrateBodyCompression(doc);
  return doc;
}

export function hookRemove(doc: Response) {
  if (!doc.bodyPath) {
    return;
  }

  fs.unlinkSync(doc.bodyPath);
}

export function getById(id: string) {
  return db.get(type, id);
}

export function all() {
  return db.all(type);
}

export async function removeForRequest(parentId: string) {
  await db.removeWhere(type, { parentId });
}

export function remove(response: Response) {
  return db.remove(response);
}

export async function findRecentForRequest(
  requestId: string,
  limit: number
): Promise<Array<Response>> {
  const responses = await db.findMostRecentlyModified(
    type,
    { parentId: requestId },
    limit
  );
  return responses;
}

export async function getLatestForRequest(
  requestId: string
): Promise<Response | null> {
  const responses = await findRecentForRequest(requestId, 1);
  const response = (responses[0]: ?Response);
  return response || null;
}

export async function create(patch: Object = {}) {
  if (!patch.parentId) {
    throw new Error('New Response missing `parentId`');
  }

  const { parentId } = patch;

  // Create request version snapshot
  const request = await models.request.getById(parentId);
  const requestVersion = request
    ? await models.requestVersion.create(request)
    : null;
  patch.requestVersionId = requestVersion ? requestVersion._id : null;

  // Delete all other responses before creating the new one
  const allResponses = await db.findMostRecentlyModified(
    type,
    { parentId },
    MAX_RESPONSES
  );
  const recentIds = allResponses.map(r => r._id);
  await db.removeWhere(type, { parentId, _id: { $nin: recentIds } });

  // Actually create the new response
  return db.docCreate(type, patch);
}

export function getLatestByParentId(parentId: string) {
  return db.getMostRecentlyModified(type, { parentId });
}

export function getBodyStream<T>(
  response: Object,
  readFailureValue: ?T
): Readable | null | T {
  return getBodyStreamFromPath(
    response.bodyPath || '',
    response.bodyCompression,
    readFailureValue
  );
}

export function getBodyBuffer<T>(
  response: Object,
  readFailureValue: ?T
): Buffer | T | null {
  return getBodyBufferFromPath(
    response.bodyPath || '',
    response.bodyCompression,
    readFailureValue
  );
}

function getBodyStreamFromPath<T>(
  bodyPath: string,
  compression: string | null,
  readFailureValue: ?T
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
  readFailureValue: ?T
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

async function migrateBodyToFileSystem(doc: Object) {
  if (doc.hasOwnProperty('body') && doc._id && !doc.bodyPath) {
    const bodyBuffer = Buffer.from(doc.body, doc.encoding || 'utf8');
    const { app } = electron.remote || electron;
    const root = app.getPath('userData');
    const dir = path.join(root, 'responses');

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
