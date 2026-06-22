import { invokeWithNormalizedError } from '~/main/ipc/invoke';
import { createServicesProxy } from '~/ui/services-proxy';

export const servicesProxy = createServicesProxy((serviceName, methodName, ...args) =>
  invokeWithNormalizedError<unknown>('services.invoke', serviceName, methodName, ...args),
);
