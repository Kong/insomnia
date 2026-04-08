import type { BaseModel } from '~/models/types';

import type { RequestTestResult } from '../../../../../insomnia-scripting-environment/src/objects';

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
  bodyBuffer?: Buffer;
  timelinePath: string;
  bodyCompression: Compression;
  error: string;
  requestVersionId: string | null;
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
    bytesContent: -1,
    elapsedTime: 0,
    headers: [],
    timelinePath: '',
    bodyPath: '',
    bodyCompression: '__NEEDS_MIGRATION__',
    error: '',
    requestVersionId: null,
    settingStoreCookies: null,
    settingSendCookies: null,
    environmentId: '__LEGACY__',
    requestTestResults: [],
    globalEnvironmentId: null,
  };
}

export function migrate(doc: Response) {
  try {
    return migrateBodyCompression(doc);
  } catch (error) {
    console.log('[db] Error during response migration', error);
    throw error;
  }
}

function migrateBodyCompression(doc: Response) {
  if (doc.bodyCompression === '__NEEDS_MIGRATION__') {
    doc.bodyCompression = 'zip';
  }

  return doc;
}
