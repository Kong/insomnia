// Single source of truth for which (serviceName, methodName) pairs have their own
// `services.<serviceName>.<methodName>` IPC handler instead of routing through the generic
// `services.invoke` gateway (see services-invoke-surface.ts, SERVICES-INVOKE-MIGRATION-PLAN.md).
// Consulted by both the preload bridge and the non-isolated renderer proxy fallback so the two
// transports can never pick a different channel for the same pair. No Node-only imports here — this
// module is bundled into the renderer as well as the main process.
export const MIGRATED_SERVICES_INVOKE_PAIRS: ReadonlySet<string> = new Set<string>([
  'caCertificate.create',
  'caCertificate.getById',
  'caCertificate.getByParentId',
  'caCertificate.removeWhere',
  'caCertificate.update',
  'clientCertificate.create',
  'clientCertificate.findByParentId',
  'clientCertificate.getById',
  'clientCertificate.remove',
  'clientCertificate.update',
]);

/** The IPC channel a `services.<serviceName>.<methodName>` call should use: the named channel once migrated, else the legacy generic gateway. */
export const resolveServicesInvokeChannel = (serviceName: string, methodName: string): string =>
  MIGRATED_SERVICES_INVOKE_PAIRS.has(`${serviceName}.${methodName}`)
    ? `services.${serviceName}.${methodName}`
    : 'services.invoke';
