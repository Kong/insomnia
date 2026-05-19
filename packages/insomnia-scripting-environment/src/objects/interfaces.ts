import type { sendCurlAndWriteTimelineError, sendCurlAndWriteTimelineResponse } from 'insomnia/src/network/network';

import type { ClientCertificate, CookieJar, Request, RequestTestResult, Settings } from '~/insomnia-data';

import type { ExecutionOption } from './execution';
import type { RequestInfoOption } from './request-info';

/** @ignore */
export interface IEnvironment {
  id: string;
  name: string;
  data: object;
}

/** @ignore */
export interface RequestContext {
  request: Request;
  timelinePath: string;
  environment: IEnvironment;
  baseEnvironment: IEnvironment;
  vault?: IEnvironment;
  collectionVariables?: object;
  // globals are optional because they are activated only when selected
  globals?: IEnvironment;
  baseGlobals?: IEnvironment;
  iterationData?: Omit<IEnvironment, 'id'>;
  timeout: number;
  settings: Settings;
  clientCertificates: ClientCertificate[];
  cookieJar: CookieJar;
  // only for the after-response script
  response?: sendCurlAndWriteTimelineResponse | sendCurlAndWriteTimelineError;
  requestTestResults?: RequestTestResult[];
  requestInfo: RequestInfoOption;
  execution: ExecutionOption;
  logs: string[];
  transientVariables?: Omit<IEnvironment, 'id'>;
  parentFolders: { id: string; name: string; environment: Record<string, any> }[];
}
