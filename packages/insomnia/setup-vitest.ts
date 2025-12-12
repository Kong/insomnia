import { NeDBClient } from 'insomnia-storage/node';
import { vi } from 'vitest';

import { configureModel, type DatabaseBuckets } from '~/models/db';

import { nodeLibcurlMock } from './src/__mocks__/@getinsomnia/node-libcurl';
import { electronMock } from './src/__mocks__/electron';
import { database as db } from './src/common/database';
import { v4Mock } from './src/models/__mocks__/uuid';

vi.mock('electron', () => ({ default: electronMock }));
export function databaseFactory(): DatabaseBuckets {
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
    // @ts-expect-error -- mapping unsoundness
    databaseBuckets[bucketName] = new NeDBClient({ inMemoryOnly: true });
  });

  return databaseBuckets;
}

configureModel({ databaseFactory });
await db.init({ inMemoryOnly: true }, true);

vi.mock('uuid', () => ({
  v4: () => v4Mock(),
}));
vi.mock('@getinsomnia/node-libcurl', () => nodeLibcurlMock);

vi.mock('isomorphic-git', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...Object.assign({}, actual),
    push: vi.fn(),
    clone: vi.fn(),
  };
});
