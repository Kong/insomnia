import type { Services } from 'insomnia-data';

import { invokeWithNormalizedError } from '~/main/ipc/invoke';

export const servicesProxy = new Proxy({} as Services, {
  get(_target, serviceName: string) {
    return new Proxy(
      {},
      {
        get(_target, methodName: string) {
          return async (...args: unknown[]) => {
            const result = await invokeWithNormalizedError<any>('services.invoke', serviceName, methodName, ...args);
            // contextBridge serializes Node.js Buffer as Uint8Array; the main process wraps
            // Buffer results with { __type: 'Buffer', data } so we can safely reconstruct here
            // without misidentifying genuine Uint8Array returns.
            // TODO: remove once service methods stop returning Buffer (tracked for deprecation).
            if (result && typeof result === 'object' && result.__type === 'Buffer' && Array.isArray(result.data)) {
              return Buffer.from(result.data);
            }
            return result;
          };
        },
      },
    );
  },
});
