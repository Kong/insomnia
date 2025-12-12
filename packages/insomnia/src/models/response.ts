import fs from 'node:fs';
import type { Readable } from 'node:stream';
import zlib from 'node:zlib';

import type { RequestTestResult } from '../../../insomnia-scripting-environment/src/objects';
import { database as db } from '../common/database';
import type { ResponseTimelineEntry } from '../main/network/libcurl-promise';
import * as requestOperations from '../models/helpers/request-operations';
import { deserializeNDJSON } from '../utils/ndjson';
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

export type Compression = 'zip' | null | '__NEEDS_MIGRATION__' | undefined;

export interface BaseResponse {
  environmentId: string | null;
  globalEnvironmentId: string | null;
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
  // if body is less than 5MB, it's stored in memory
  bodyBuffer?: Buffer;
  // Actual bodies are stored on the filesystem
  timelinePath: string;
  // Actual timelines are stored on the filesystem
  bodyCompression: Compression;
  error: string;
  requestVersionId: string | null;
  // Things from the request
  settingStoreCookies: boolean | null;
  settingSendCookies: boolean | null;
  requestTestResults: RequestTestResult[];
}

export type Response = BaseModel & BaseResponse;

export const isResponse = (model: Pick<BaseModel, 'type'>): model is Response => model.type === type;

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
    requestTestResults: [],
    globalEnvironmentId: null,
  };
}

export function migrate(doc: Response) {
  try {
    return migrateBodyCompression(doc);
  } catch (e) {
    console.log('[db] Error during response migration', e);
    throw e;
  }
}
export function getById(id: string) {
  return db.findOne<Response>(type, { _id: id });
}

export function findByParentId(parentId: string) {
  return db.find<Response>(type, { parentId: parentId });
}

export async function all() {
  return db.find<Response>(type);
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
  const toDelete = await db.find<Response>(type, query);
  for (const doc of toDelete) {
    fs.promises.unlink(doc.bodyPath);
    fs.promises.unlink(doc.timelinePath);
  }
  // Also delete legacy responses here or else the user will be confused as to
  // why some responses are still showing in the UI.
  await db.removeWhere(type, query);
}

export function remove(response: Response) {
  fs.promises.unlink(response.bodyPath);
  fs.promises.unlink(response.timelinePath);
  return db.remove(response);
}

export async function getLatestForRequestId(
  requestId: string,
  environmentId: string | null,
): Promise<Response | undefined> {
  // Filter responses by environment if setting is enabled
  const shouldFilter = (await models.settings.get()).filterResponsesByEnv;

  const response = await db.findOne<Response>(
    type,
    {
      parentId: requestId,
      ...(shouldFilter ? { environmentId } : {}),
    },
    { modified: -1 },
  );
  return response;
}

export async function create(patch: Partial<Response> = {}, maxResponses = 20): Promise<Response> {
  if (!patch.parentId) {
    console.log('[db] Attempted to create response without `parentId`', patch);
    throw new Error('New Response missing `parentId`');
  }

  const { parentId } = patch;
  // Create request version snapshot
  const request = await requestOperations.getById(parentId);
  const requestVersion = request ? await models.requestVersion.create(request) : null;
  patch.requestVersionId = requestVersion ? requestVersion._id : null;
  // Filter responses by environment if setting is enabled
  const settings = await models.settings.get();
  const shouldQueryByEnvId = 'environmentId' in patch && settings.filterResponsesByEnv;
  const query = {
    parentId,
    ...(shouldQueryByEnvId ? { environmentId: patch.environmentId } : {}),
  };

  // Delete all other responses before creating the new one
  const responsesToShow = Math.max(1, maxResponses);

  const allResponses = await db.find<Response>(type, query, { modified: -1 }, responsesToShow);

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

export const getBodyStream = (
  response?: { bodyPath?: string; bodyCompression?: Compression },
  readFailureValue?: string,
): Readable | string | null => {
  if (!response?.bodyPath) {
    return null;
  }
  try {
    fs.statSync(response?.bodyPath);
  } catch (err) {
    console.warn('Failed to read response body', err.message);
    return readFailureValue === undefined ? null : readFailureValue;
  }
  if (response?.bodyCompression === 'zip') {
    return fs.createReadStream(response?.bodyPath).pipe(zlib.createGunzip());
  }
  return fs.createReadStream(response?.bodyPath);
};
export const readCurlResponse = async (options: { bodyPath?: string; bodyCompression?: Compression }) => {
  const readFailureMsg = '[main/curlBridgeAPI] failed to read response body message';
  const bodyBufferOrErrMsg = await getBodyBuffer(options, readFailureMsg);
  // TODO(jackkav): simplify the fail msg and reuse in other getBodyBuffer renderer calls

  if (!bodyBufferOrErrMsg) {
    return { body: '', error: readFailureMsg };
  } else if (typeof bodyBufferOrErrMsg === 'string') {
    if (bodyBufferOrErrMsg === readFailureMsg) {
      return { body: '', error: readFailureMsg };
    }
    return { body: '', error: `unknown error in loading response body: ${bodyBufferOrErrMsg}` };
  }

  return { body: bodyBufferOrErrMsg.toString('utf8'), error: '' };
};
export const getBodyBuffer = async (
  response?: { bodyPath?: string; bodyCompression?: Compression },
  readFailureValue?: string,
): Promise<Buffer | string> => {
  if (!response?.bodyPath) {
    // No body, so return empty Buffer
    return Buffer.alloc(0);
  }
  try {
    // TODO: unpick theis read buffer so it can be used as a simple string reader
    const rawBuffer = await fs.promises.readFile(response?.bodyPath);
    if (response?.bodyCompression === 'zip') {
      return new Promise((resolve, reject) =>
        zlib.gunzip(rawBuffer, (err, buffer) => (err ? reject(err) : resolve(buffer))),
      );
    }

    return rawBuffer;
  } catch (err) {
    console.warn('Failed to read response body', err.message);
    return readFailureValue === undefined ? Buffer.alloc(0) : readFailureValue;
  }
};

export function getTimeline(response: Response, showBody?: boolean) {
  const { timelinePath, bodyPath } = response;

  if (!timelinePath) {
    return [];
  }

  try {
    const rawBuffer = fs.readFileSync(timelinePath);
    const timelineString = rawBuffer.toString();
    const timeline = deserializeNDJSON(timelineString);

    const body: ResponseTimelineEntry[] = showBody
      ? [
          {
            name: 'DataOut',
            timestamp: Date.now(),
            value: fs.readFileSync(bodyPath).toString(),
          },
        ]
      : [];
    const output = [...timeline, ...body];
    return output;
  } catch (err) {
    console.warn('Failed to read response body', err.message);
    return [];
  }
}

function migrateBodyCompression(doc: Response) {
  if (doc.bodyCompression === '__NEEDS_MIGRATION__') {
    doc.bodyCompression = 'zip';
  }

  return doc;
}
