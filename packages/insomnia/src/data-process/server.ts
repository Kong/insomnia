import type { IDatabase } from 'insomnia-data';
import { database, type Services, services } from 'insomnia-data';

import { type SerializedError, serializeError } from './serialization';

export interface DataRequest {
  id: string;
  type: 'invoke';
  namespace: 'services' | 'database';
  /** 'services' namespace: "serviceName.methodName", e.g. "request.getById"
   *  'database' namespace: method name on IDatabase, e.g. "find"
   */
  method: string;
  args: unknown[];
}

interface DataResponseOk {
  id: string;
  ok: true;
  result: unknown;
}
interface DataResponseError {
  id: string;
  ok: false;
  error: SerializedError;
}
type DataResponse = DataResponseOk | DataResponseError;

async function dispatch(req: DataRequest): Promise<unknown> {
  if (req.namespace === 'database') {
    const fn = database[req.method as keyof IDatabase];
    if (typeof fn !== 'function') {
      throw new TypeError(`Unknown database method: ${req.method}`);
    }
    return (fn as (...args: unknown[]) => unknown).call(database, ...req.args);
  }
  if (req.namespace === 'services') {
    const [serviceName, methodName] = req.method.split('.');
    if (!serviceName || !methodName) {
      throw new TypeError(`Invalid services method format: ${req.method}`);
    }
    const service = services[serviceName as keyof Services];
    if (!service) {
      throw new TypeError(`Unknown service: ${serviceName}`);
    }
    const fn = service[methodName as keyof typeof service];
    if (typeof fn !== 'function') {
      throw new TypeError(`Unknown service method: ${serviceName}.${methodName}`);
    }
    return (fn as (...args: unknown[]) => unknown).call(service, ...req.args);
  }
  throw new TypeError(`Unknown namespace: ${req.namespace}`);
}

async function handleRequest(port: Electron.MessagePortMain, req: DataRequest): Promise<void> {
  let response: DataResponse;
  try {
    const raw = await dispatch(req);
    response = { id: req.id, ok: true, result: raw };
  } catch (e) {
    response = { id: req.id, ok: false, error: serializeError(e) };
  }
  port.postMessage(response);
}

function attachPort(port: Electron.MessagePortMain): void {
  console.debug('[data-process] port attached');
  port.on('message', (event: Electron.MessageEvent) => {
    handleRequest(port, event.data as DataRequest).catch(e => {
      console.error('[data-process] unhandled error in handleRequest:', e);
    });
  });
  port.start();
}

export function startDataProcessServer(): void {
  process.parentPort.on('message', (event: Electron.MessageEvent) => {
    const msg = event.data as Record<string, unknown>;

    if (msg?.type === 'new-port') {
      const port = event.ports[0];
      if (port) {
        attachPort(port);
      }
    }
  });
}
