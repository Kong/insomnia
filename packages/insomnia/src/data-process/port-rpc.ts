import { deserializeError, deserializeValue, type SerializedError, serializeValue } from './serialization';

export type InvokeFn = (namespace: 'services' | 'database', method: string, ...args: unknown[]) => Promise<unknown>;

interface DataResponse {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: SerializedError;
}

/**
 * Transport-agnostic RPC client for the data-process.
 *
 * Works with any port-like transport (MessagePort in renderer, MessagePortMain
 * in main process). The caller provides `send` and `onMessage` adapters in
 * `attach()`. Handles request/response correlation, error deserialization, and
 * port lifecycle (invalidate on restart).
 */
export class PortRpc {
  private send: ((msg: unknown) => void) | null = null;
  private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  attach(send: (msg: unknown) => void, onMessage: (handler: (data: DataResponse) => void) => void): void {
    this.send = send;
    onMessage(data => {
      const p = this.pending.get(data.id);
      if (!p) return;
      this.pending.delete(data.id);
      data.ok ? p.resolve(deserializeValue(data.result)) : p.reject(deserializeError(data.error!));
    });
    console.debug('[port-rpc] attached', { pendingCount: this.pending.size });
  }

  invalidate(reason: string): void {
    const pendingCount = this.pending.size;
    this.pending.forEach(({ reject }) => reject(new Error(reason)));
    this.pending.clear();
    this.send = null;
    console.warn(`[port-rpc] invalidated: ${reason}`, { rejectedCount: pendingCount });
  }

  invoke: InvokeFn = (namespace, method, ...args) => {
    if (!this.send) {
      console.error(`[port-rpc] invoke failed – port not available: ${namespace}.${method}`);
      return Promise.reject(new Error('data port not available'));
    }
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send!({ id, type: 'invoke', namespace, method, args: serializeValue(args) });
    });
  };
}
