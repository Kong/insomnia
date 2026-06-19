import type { Services } from 'insomnia-data';

export type ServicesInvoke = (serviceName: string, methodName: string, ...args: unknown[]) => Promise<unknown>;

// Build the services proxy from a generic invoke function. Kept free of any
// `electron` import so it can run in the isolated renderer world, where the
// bridged invoke is the only available transport (see entry.client.tsx).
export const createServicesProxy = (invoke: ServicesInvoke): Services =>
  new Proxy({} as Services, {
    get(_target, serviceName: string) {
      return new Proxy(
        {},
        {
          get(_target, methodName: string) {
            return (...args: unknown[]) => invoke(serviceName, methodName, ...args);
          },
        },
      );
    },
  });
