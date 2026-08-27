import type { SyncIpcHandler } from '~/main/cloud-sync/sync-ipc-handler';

type OmitSender<Fn> = Fn extends (sender: any, ...args: infer A) => infer R ? (...args: A) => R : never;

// Mapping directly over `keyof T` (with `as` key remapping) keeps this a homomorphic
// mapped type, which lets "Go to Definition" on a trigger method jump to its source
// method on the handler class. Deriving the key set separately (e.g. via a helper type
// indexed by `[keyof T]`) breaks that link.
export type IpcTriggerAPI<T> = {
  [K in keyof T as T[K] extends (...args: any[]) => any ? (K extends 'register' ? never : K) : never]: OmitSender<T[K]>;
};

function createIpcTrigger<T>(domain: string) {
  return new Proxy({} as IpcTriggerAPI<T>, {
    get(_target, methodName: string) {
      return (...args: unknown[]) => window._mainInvoke!(domain, methodName, ...args);
    },
  });
}

const sync = createIpcTrigger<SyncIpcHandler>('sync');

export { sync };
