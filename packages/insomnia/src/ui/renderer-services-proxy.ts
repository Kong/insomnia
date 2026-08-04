import { invokeWithNormalizedError } from '~/main/ipc/invoke';
import { resolveServicesInvokeChannel } from '~/main/ipc/migrated-services-invoke-pairs';
import { createServicesProxy } from '~/ui/services-proxy';

export const servicesProxy = createServicesProxy((serviceName, methodName, ...args) => {
  const channel = resolveServicesInvokeChannel(serviceName, methodName);
  return invokeWithNormalizedError<unknown>(channel, ...args);
});
