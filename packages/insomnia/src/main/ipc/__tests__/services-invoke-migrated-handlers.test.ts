import { describe, expect, it, vi } from 'vitest';

import * as handlers from '../services-invoke-migrated-handlers';

vi.mock('insomnia-data', () => ({
  services: {
    caCertificate: { create: vi.fn(), getById: vi.fn(), getByParentId: vi.fn(), removeWhere: vi.fn(), update: vi.fn() },
    clientCertificate: { create: vi.fn(), findByParentId: vi.fn(), getById: vi.fn(), remove: vi.fn(), update: vi.fn() },
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
