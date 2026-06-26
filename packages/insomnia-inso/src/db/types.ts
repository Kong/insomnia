import type { Database } from './models/types';

export type { Database } from './models/types';

export const emptyDb = (): Database => ({
  ApiSpec: [],
  Environment: [],
  Request: [],
  RequestGroup: [],
  Workspace: [],
  WorkspaceMeta: [],
  UnitTest: [],
  UnitTestSuite: [],
  ClientCertificate: [],
  CaCertificate: [],
  CookieJar: [],
  CloudCredential: [],
  Settings: [],
});

export type DbAdapter = (dir: string, filterTypes?: (keyof Database)[]) => Promise<Database | null>;
