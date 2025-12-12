import fsPath from 'node:path';

import type { DBItem } from 'insomnia-storage';
import { NeDBClient } from 'insomnia-storage/node';

import type { DatabaseBuckets } from '~/models/db';

export const genDatabaseFactory =
  (dbPath: string) =>
  <T extends DBItem>(): DatabaseBuckets => {
    const databaseBuckets: DatabaseBuckets = {} as DatabaseBuckets;
    [
      'ApiSpec',
      'CaCertificate',
      'ClientCertificate',
      'CloudCredential',
      'CookieJar',
      'Environment',
      'GitCredentials',
      'GitRepository',
      'GrpcRequest',
      'GrpcRequestMeta',
      'MockRoute',
      'MockServer',
      'McpRequest',
      'McpResponse',
      'McpPayload',
      'OAuth2Token',
      'PluginData',
      'Project',
      'ProtoDirectory',
      'ProtoFile',
      'Request',
      'RequestGroup',
      'RequestGroupMeta',
      'RequestMeta',
      'RequestVersion',
      'Response',
      'RunnerTestResult',
      'Settings',
      'SocketIOPayload',
      'SocketIORequest',
      'SocketIOResponse',
      'Stats',
      'UnitTest',
      'UnitTestResult',
      'UnitTestSuite',
      'UserSession',
      'WebSocketPayload',
      'WebSocketRequest',
      'WebSocketResponse',
      'Workspace',
      'WorkspaceMeta',
    ].forEach(bucketName => {
      const filename = fsPath.join(dbPath, `insomnia.${bucketName}.db`);
      // @ts-expect-error -- mapping unsoundness
      databaseBuckets[bucketName] = new NeDBClient<T>({ filename });
    });

    return databaseBuckets;
  };
