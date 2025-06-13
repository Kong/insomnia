import type { ClientCertificate } from 'insomnia/src/models/client-certificate';
import type { CookieJar as InsomniaCookieJar } from 'insomnia/src/models/cookie-jar';
import type { Request } from 'insomnia/src/models/request';
import type { Settings } from 'insomnia/src/models/settings';
import type { sendCurlAndWriteTimelineError, sendCurlAndWriteTimelineResponse } from 'insomnia/src/network/network';

import type { ExecutionOption } from './execution';
import type { RequestInfoOption } from './request-info';
import type { RequestTestResult } from './test';

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
  globals?: object;
  baseGlobals?: object;
  iterationData?: Omit<IEnvironment, 'id'>;
  timeout: number;
  settings: Settings;
  clientCertificates: ClientCertificate[];
  cookieJar: InsomniaCookieJar;
  // only for the after-response script
  response?: sendCurlAndWriteTimelineResponse | sendCurlAndWriteTimelineError;
  requestTestResults?: RequestTestResult[];
  requestInfo: RequestInfoOption;
  execution: ExecutionOption;
  logs: string[];
  transientVariables?: Omit<IEnvironment, 'id'>;
  parentFolders: { id: string; name: string; environment: Record<string, any> }[];
}
