import type {
  ApiSpec,
  BaseModel,
  CaCertificate,
  ClientCertificate,
  CloudProviderCredential,
  CookieJar,
  Environment,
  Settings,
  UnitTest,
  UnitTestSuite,
  Workspace,
  WorkspaceMeta,
} from 'insomnia-data';

export interface Database {
  ApiSpec: ApiSpec[];
  Environment: Environment[];
  Request: BaseModel[];
  RequestGroup: BaseModel[];
  Workspace: Workspace[];
  WorkspaceMeta: WorkspaceMeta[];
  UnitTestSuite: UnitTestSuite[];
  UnitTest: UnitTest[];
  ClientCertificate: ClientCertificate[];
  CaCertificate: CaCertificate[];
  CookieJar: CookieJar[];
  CloudCredential: CloudProviderCredential[];
  Settings: Settings[];
}

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
