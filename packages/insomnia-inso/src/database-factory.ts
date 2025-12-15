import fsPath from 'node:path';

import type { DatabaseBuckets } from 'insomnia/src/models/db';
import type { DBItem } from 'insomnia-storage';
import { NeDBClient } from 'insomnia-storage/node';

export const genDatabaseFactory =
  (dbPath?: string) =>
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
      const filename = dbPath ? fsPath.join(dbPath, `insomnia.${bucketName}.db`) : undefined;
      // @ts-expect-error -- mapping unsoundness
      databaseBuckets[bucketName] = new NeDBClient<T>(filename ? { filename } : { inMemoryOnly: true });
    });

    return databaseBuckets;
  };
