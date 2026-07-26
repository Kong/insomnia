import type { CaCertificate, ClientCertificate } from 'insomnia-data';
import { services } from 'insomnia-data';

// Named per-pair handlers for services.invoke pairs migrated off the generic reflection-based
// gateway (see services-invoke-surface.ts, SERVICES-INVOKE-MIGRATION-PLAN.md). Each forwards to the
// exact same services.* call the generic dispatch made for that pair, with the same arguments — main.ts
// registers each of these under the literal channel name `services.<serviceName>.<methodName>`.

export const caCertificateCreate = (_: unknown, patch: Partial<CaCertificate> = {}) => services.caCertificate.create(patch);
export const caCertificateGetById = (_: unknown, id: string) => services.caCertificate.getById(id);
export const caCertificateGetByParentId = (_: unknown, parentId: string) => services.caCertificate.getByParentId(parentId);
export const caCertificateRemoveWhere = (_: unknown, parentId: string) => services.caCertificate.removeWhere(parentId);
export const caCertificateUpdate = (_: unknown, cert: CaCertificate, patch: Partial<CaCertificate> = {}) => services.caCertificate.update(cert, patch);

export const clientCertificateCreate = (_: unknown, patch: Partial<ClientCertificate> = {}) => services.clientCertificate.create(patch);
export const clientCertificateFindByParentId = (_: unknown, parentId: string) => services.clientCertificate.findByParentId(parentId);
export const clientCertificateGetById = (_: unknown, id: string) => services.clientCertificate.getById(id);
export const clientCertificateRemove = (_: unknown, cert: ClientCertificate) => services.clientCertificate.remove(cert);
export const clientCertificateUpdate = (_: unknown, cert: ClientCertificate, patch: Partial<ClientCertificate> = {}) => services.clientCertificate.update(cert, patch);
