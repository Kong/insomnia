import { services } from '~/insomnia-data';

import type { RequestTestResult } from '../../../insomnia-scripting-environment/src/objects';
import { database as db } from '../common/database';
import * as requestOperations from '../models/helpers/request-operations';
import * as requestVersionModel from './request-version';
import type { BaseModel } from './types';

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

export async function getLatestForRequestId(
  requestId: string,
  environmentId: string | null,
): Promise<Response | undefined> {
  // Filter responses by environment if setting is enabled
  const shouldFilter = (await services.settings.get()).filterResponsesByEnv;

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
  const requestVersion = request ? await requestVersionModel.create(request) : null;
  patch.requestVersionId = requestVersion ? requestVersion._id : null;
  // Filter responses by environment if setting is enabled
  const settings = await services.settings.get();
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

function migrateBodyCompression(doc: Response) {
  if (doc.bodyCompression === '__NEEDS_MIGRATION__') {
    doc.bodyCompression = 'zip';
  }

  return doc;
}
