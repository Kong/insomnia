import type { Services } from 'insomnia-data';

import { invokeWithNormalizedError } from '~/main/ipc/invoke';

export const servicesProxy = new Proxy({} as Services, {
  get(_target, serviceName: string) {
    return new Proxy(
      {},
      {
        get(_target, methodName: string) {
          return (...args: unknown[]) =>
            invokeWithNormalizedError<any>('services.invoke', serviceName, methodName, ...args);
        },
      },
    );
  },
});
