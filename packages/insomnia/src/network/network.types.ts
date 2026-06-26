import type { Cookie } from 'insomnia-data';

import type { ResponsePatch } from '../main/network/libcurl-promise';

export interface sendCurlAndWriteTimelineError {
  _id: string;
  parentId: string;
  timelinePath: string;
  statusMessage: string;
  // additional
  url: string;
  error: string;
  elapsedTime: number;
  bytesRead: number;
}

export interface sendCurlAndWriteTimelineResponse extends ResponsePatch {
  _id: string;
  parentId: string;
  timelinePath: string;
  statusMessage: string;
  cookies: Cookie[];
  timeline: string[];
  bytesRead?: number;
}
