import type { IDatabase, Services } from 'insomnia-data';
import { initDatabase, initServices } from 'insomnia-data';

import { type InvokeFn } from './port-rpc';

export interface DataBridgeOptions {
  database?: Partial<IDatabase>;
}

/**
 * Initialises the database and services bridges from a single invoke function.
 *
 * @param invoke - The RPC invoke function (InvokeFn from PortRpc, or mainRpc.invoke).
 *   May be undefined when called from a renderer — an error is thrown in that case.
 * @param options.database - Optional Partial<IDatabase> overrides (e.g. onChange for main process).
 */
export async function initDataBridge(
  invoke: InvokeFn | undefined,
  options?: DataBridgeOptions,
): Promise<void> {
  if (!invoke) {
    throw new Error(
      'Data port bridge is not available. This entrypoint must run in an environment with the preload bridge.',
    );
  }

  await initDatabase(
    new Proxy((options?.database ?? {}) as IDatabase, {
      get(target, prop) {
        if (prop in target) return target[prop as keyof IDatabase];
        return (...args: unknown[]) => invoke('database', prop as string, ...args);
      },
    }),
  );

  initServices(
    new Proxy({} as Services, {
      get(_target, serviceName: string) {
        return new Proxy({}, {
          get(_target, methodName: string) {
            return (...args: unknown[]) => invoke('services', `${serviceName}.${methodName}`, ...args);
          },
        });
      },
    }),
  );
}
