import type { CurlInfoDebug } from '@getinsomnia/node-libcurl';

import type { BaseModel } from './base-types';
import type { RequestTestResult } from './runner-test-result';

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

export interface ResponseTimelineEntry {
  name: keyof typeof CurlInfoDebug;
  timestamp: number;
  value: string;
}

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
