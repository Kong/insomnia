import { describe, expect, it, vi } from 'vitest';

import * as handlers from '../services-invoke-migrated-handlers';

vi.mock('insomnia-data', () => ({
  services: {
    caCertificate: { create: vi.fn(), getById: vi.fn(), getByParentId: vi.fn(), removeWhere: vi.fn(), update: vi.fn() },
    clientCertificate: { create: vi.fn(), findByParentId: vi.fn(), getById: vi.fn(), remove: vi.fn(), update: vi.fn() },
    cloudCredential: { all: vi.fn(), create: vi.fn(), getById: vi.fn(), getByName: vi.fn(), remove: vi.fn(), update: vi.fn() },
    settings: { get: vi.fn(), getOrCreate: vi.fn(), patch: vi.fn(), update: vi.fn() },
    gitCredentials: { all: vi.fn(), create: vi.fn(), getById: vi.fn(), remove: vi.fn(), removeAll: vi.fn(), update: vi.fn() },
    userSession: { get: vi.fn(), remove: vi.fn(), update: vi.fn() },
    environment: {
      create: vi.fn(), update: vi.fn(), list: vi.fn(), listByParentId: vi.fn(), getOrCreateForParentId: vi.fn(),
      getById: vi.fn(), getByParentId: vi.fn(), duplicate: vi.fn(), remove: vi.fn(), removeAllSecrets: vi.fn(),
    },
    apiSpec: { getByParentId: vi.fn(), getOrCreateForParentId: vi.fn(), update: vi.fn(), updateOrCreateForParentId: vi.fn() },
    cookieJar: { getById: vi.fn(), getOrCreateForParentId: vi.fn(), update: vi.fn() },
    gitRepository: { all: vi.fn(), getAllByCredentialId: vi.fn(), getById: vi.fn(), remove: vi.fn(), update: vi.fn() },
    grpcRequest: { create: vi.fn(), findByProtoFileId: vi.fn() },
    grpcRequestMeta: { getByParentId: vi.fn(), updateOrCreateByParentId: vi.fn() },
    helpers: {
      abortCommandSearch: vi.fn(), commandSearch: vi.fn(), duplicateRequest: vi.fn(), findRequestByParentId: vi.fn(),
      getRequestById: vi.fn(), getResponseBodyBuffer: vi.fn(), getResponseTimeline: vi.fn(), queryAllWorkspaceUrls: vi.fn(),
      readCurlResponse: vi.fn(), removeRequest: vi.fn(), removeResponse: vi.fn(), removeResponsesForRequest: vi.fn(),
      updateRequest: vi.fn(),
    },
  },
}));

// Reference behavior: exactly what the old services.invoke reflection dispatch did for a
// (serviceName, methodName) pair — `services[serviceName][methodName](...args)`. Every migrated
// named handler below is checked against this, not just against its own naming convention.
const legacyDispatch = async (serviceName: string, methodName: string, ...args: unknown[]) => {
  const { services } = await import('insomnia-data');
  const service = (services as unknown as Record<string, Record<string, (...a: unknown[]) => unknown>>)[serviceName];
  return service[methodName](...args);
};

const CASES: { handlerName: keyof typeof handlers; serviceName: string; methodName: string; args: unknown[] }[] = [
  { handlerName: 'caCertificateCreate', serviceName: 'caCertificate', methodName: 'create', args: [{ parentId: 'w1' }] },
  { handlerName: 'caCertificateGetById', serviceName: 'caCertificate', methodName: 'getById', args: ['cert1'] },
  { handlerName: 'caCertificateGetByParentId', serviceName: 'caCertificate', methodName: 'getByParentId', args: ['w1'] },
  { handlerName: 'caCertificateRemoveWhere', serviceName: 'caCertificate', methodName: 'removeWhere', args: ['w1'] },
  { handlerName: 'caCertificateUpdate', serviceName: 'caCertificate', methodName: 'update', args: [{ _id: 'cert1' }, { path: '/new.pem' }] },
  { handlerName: 'clientCertificateCreate', serviceName: 'clientCertificate', methodName: 'create', args: [{ parentId: 'w1' }] },
  { handlerName: 'clientCertificateFindByParentId', serviceName: 'clientCertificate', methodName: 'findByParentId', args: ['w1'] },
  { handlerName: 'clientCertificateGetById', serviceName: 'clientCertificate', methodName: 'getById', args: ['cert1'] },
  { handlerName: 'clientCertificateRemove', serviceName: 'clientCertificate', methodName: 'remove', args: [{ _id: 'cert1' }] },
  { handlerName: 'clientCertificateUpdate', serviceName: 'clientCertificate', methodName: 'update', args: [{ _id: 'cert1' }, { host: 'localhost' }] },
  { handlerName: 'cloudCredentialAll', serviceName: 'cloudCredential', methodName: 'all', args: [] },
  { handlerName: 'cloudCredentialCreate', serviceName: 'cloudCredential', methodName: 'create', args: [{ name: 'konnect' }] },
  { handlerName: 'cloudCredentialGetById', serviceName: 'cloudCredential', methodName: 'getById', args: ['cred1'] },
  { handlerName: 'cloudCredentialGetByName', serviceName: 'cloudCredential', methodName: 'getByName', args: ['konnect', 'konnect'] },
  { handlerName: 'cloudCredentialRemove', serviceName: 'cloudCredential', methodName: 'remove', args: [{ _id: 'cred1' }] },
  { handlerName: 'cloudCredentialUpdate', serviceName: 'cloudCredential', methodName: 'update', args: [{ _id: 'cred1' }, { credentials: undefined }] },
  { handlerName: 'settingsGet', serviceName: 'settings', methodName: 'get', args: [] },
  { handlerName: 'settingsGetOrCreate', serviceName: 'settings', methodName: 'getOrCreate', args: [] },
  { handlerName: 'settingsPatch', serviceName: 'settings', methodName: 'patch', args: [{ httpProxy: '' }] },
  { handlerName: 'settingsUpdate', serviceName: 'settings', methodName: 'update', args: [{ _id: 'set1' }, { httpProxy: '' }] },
  { handlerName: 'gitCredentialsAll', serviceName: 'gitCredentials', methodName: 'all', args: [] },
  { handlerName: 'gitCredentialsCreate', serviceName: 'gitCredentials', methodName: 'create', args: [{ oauth2format: 'github' }] },
  { handlerName: 'gitCredentialsGetById', serviceName: 'gitCredentials', methodName: 'getById', args: ['cred1'] },
  { handlerName: 'gitCredentialsRemove', serviceName: 'gitCredentials', methodName: 'remove', args: [{ _id: 'cred1' }] },
  { handlerName: 'gitCredentialsRemoveAll', serviceName: 'gitCredentials', methodName: 'removeAll', args: [] },
  { handlerName: 'gitCredentialsUpdate', serviceName: 'gitCredentials', methodName: 'update', args: [{ _id: 'cred1' }, { token: 'x' }] },
  { handlerName: 'userSessionGet', serviceName: 'userSession', methodName: 'get', args: [] },
  { handlerName: 'userSessionRemove', serviceName: 'userSession', methodName: 'remove', args: [] },
  { handlerName: 'userSessionUpdate', serviceName: 'userSession', methodName: 'update', args: [{ vaultKey: 'x' }] },
  { handlerName: 'environmentCreate', serviceName: 'environment', methodName: 'create', args: [{ parentId: 'w1' }] },
  { handlerName: 'environmentUpdate', serviceName: 'environment', methodName: 'update', args: [{ _id: 'env1' }, { name: 'renamed' }] },
  { handlerName: 'environmentList', serviceName: 'environment', methodName: 'list', args: [{ parentId: 'w1' }, { metaSortKey: 1 }, 10] },
  { handlerName: 'environmentListByParentId', serviceName: 'environment', methodName: 'listByParentId', args: ['w1'] },
  { handlerName: 'environmentGetOrCreateForParentId', serviceName: 'environment', methodName: 'getOrCreateForParentId', args: ['w1'] },
  { handlerName: 'environmentGetById', serviceName: 'environment', methodName: 'getById', args: ['env1'] },
  { handlerName: 'environmentGetByParentId', serviceName: 'environment', methodName: 'getByParentId', args: ['w1'] },
  { handlerName: 'environmentDuplicate', serviceName: 'environment', methodName: 'duplicate', args: [{ _id: 'env1' }] },
  { handlerName: 'environmentRemove', serviceName: 'environment', methodName: 'remove', args: [{ _id: 'env1' }] },
  { handlerName: 'environmentRemoveAllSecrets', serviceName: 'environment', methodName: 'removeAllSecrets', args: [['org1']] },
  { handlerName: 'apiSpecGetByParentId', serviceName: 'apiSpec', methodName: 'getByParentId', args: ['w1'] },
  { handlerName: 'apiSpecGetOrCreateForParentId', serviceName: 'apiSpec', methodName: 'getOrCreateForParentId', args: ['w1', {}] },
  { handlerName: 'apiSpecUpdate', serviceName: 'apiSpec', methodName: 'update', args: [{ _id: 'spec1' }, { contents: 'x' }] },
  { handlerName: 'apiSpecUpdateOrCreateForParentId', serviceName: 'apiSpec', methodName: 'updateOrCreateForParentId', args: ['w1', { contents: 'x' }] },
  { handlerName: 'cookieJarGetById', serviceName: 'cookieJar', methodName: 'getById', args: ['jar1'] },
  { handlerName: 'cookieJarGetOrCreateForParentId', serviceName: 'cookieJar', methodName: 'getOrCreateForParentId', args: ['w1'] },
  { handlerName: 'cookieJarUpdate', serviceName: 'cookieJar', methodName: 'update', args: [{ _id: 'jar1' }, { cookies: [] }] },
  { handlerName: 'gitRepositoryAll', serviceName: 'gitRepository', methodName: 'all', args: [] },
  { handlerName: 'gitRepositoryGetAllByCredentialId', serviceName: 'gitRepository', methodName: 'getAllByCredentialId', args: ['cred1'] },
  { handlerName: 'gitRepositoryGetById', serviceName: 'gitRepository', methodName: 'getById', args: ['repo1'] },
  { handlerName: 'gitRepositoryRemove', serviceName: 'gitRepository', methodName: 'remove', args: [{ _id: 'repo1' }] },
  { handlerName: 'gitRepositoryUpdate', serviceName: 'gitRepository', methodName: 'update', args: [{ _id: 'repo1' }, { uri: 'x' }] },
  { handlerName: 'grpcRequestCreate', serviceName: 'grpcRequest', methodName: 'create', args: [{ parentId: 'w1' }] },
  { handlerName: 'grpcRequestFindByProtoFileId', serviceName: 'grpcRequest', methodName: 'findByProtoFileId', args: ['pf1'] },
  { handlerName: 'grpcRequestMetaGetByParentId', serviceName: 'grpcRequestMeta', methodName: 'getByParentId', args: ['req1'] },
  { handlerName: 'grpcRequestMetaUpdateOrCreateByParentId', serviceName: 'grpcRequestMeta', methodName: 'updateOrCreateByParentId', args: ['req1', { expandedTypes: [] }] },
  { handlerName: 'helpersAbortCommandSearch', serviceName: 'helpers', methodName: 'abortCommandSearch', args: ['req1'] },
  { handlerName: 'helpersCommandSearch', serviceName: 'helpers', methodName: 'commandSearch', args: [{ allOrganizations: [], organizationId: 'o1', projectId: 'p1', requestId: 'req1' }] },
  { handlerName: 'helpersDuplicateRequest', serviceName: 'helpers', methodName: 'duplicateRequest', args: [{ _id: 'req1' }, { name: 'copy' }] },
  { handlerName: 'helpersFindRequestByParentId', serviceName: 'helpers', methodName: 'findRequestByParentId', args: ['w1'] },
  { handlerName: 'helpersGetRequestById', serviceName: 'helpers', methodName: 'getRequestById', args: ['req1'] },
  { handlerName: 'helpersGetResponseBodyBuffer', serviceName: 'helpers', methodName: 'getResponseBodyBuffer', args: [{ bodyPath: '/x' }, 'fail'] },
  { handlerName: 'helpersGetResponseTimeline', serviceName: 'helpers', methodName: 'getResponseTimeline', args: [{ timelinePath: '/x' }, true] },
  { handlerName: 'helpersQueryAllWorkspaceUrls', serviceName: 'helpers', methodName: 'queryAllWorkspaceUrls', args: ['w1', 'Request', 'req1'] },
  { handlerName: 'helpersReadCurlResponse', serviceName: 'helpers', methodName: 'readCurlResponse', args: [{ bodyPath: '/x' }] },
  { handlerName: 'helpersRemoveRequest', serviceName: 'helpers', methodName: 'removeRequest', args: [{ _id: 'req1' }] },
  { handlerName: 'helpersRemoveResponse', serviceName: 'helpers', methodName: 'removeResponse', args: [{ _id: 'res1' }] },
  { handlerName: 'helpersRemoveResponsesForRequest', serviceName: 'helpers', methodName: 'removeResponsesForRequest', args: ['req1', 'env1'] },
  { handlerName: 'helpersUpdateRequest', serviceName: 'helpers', methodName: 'updateRequest', args: [{ _id: 'req1' }, { name: 'renamed' }] },
];

describe.each(CASES)('$handlerName', ({ handlerName, serviceName, methodName, args }) => {
  it('forwards to the same services.* call, with the same args and result, as the old services.invoke dispatch', async () => {
    const { services } = await import('insomnia-data');
    const service = (services as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>)[serviceName];
    service[methodName].mockReset().mockResolvedValue({ sentinel: `${handlerName}-result` });

    const legacyResult = await legacyDispatch(serviceName, methodName, ...args);
    const namedHandlerResult = await (handlers[handlerName] as (...a: unknown[]) => unknown)({}, ...args);

    expect(namedHandlerResult).toEqual(legacyResult);
    expect(service[methodName]).toHaveBeenCalledWith(...args);
  });
});
