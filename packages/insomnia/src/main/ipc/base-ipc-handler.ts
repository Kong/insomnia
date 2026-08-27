import type { HandleChannels, MainOnChannels } from '../ipc/electron';
import { ipcMainHandle, ipcMainOn } from '../ipc/electron';

export abstract class BaseIpcHandler {
  abstract channel: string;
}

function callMethod(
  this: any,
  methodName: string,
  event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent,
  ...args: unknown[]
) {
  const method = this[methodName as keyof typeof this];
  if (typeof method !== 'function') {
    throw new TypeError(`Method ${methodName} is not a function`);
  }
  return method.call(this, event.sender, ...args);
}

function registerHandler(handler: BaseIpcHandler) {
  ipcMainHandle(`${handler.channel}.invoke` as HandleChannels, (event, methodName, ...args: unknown[]) => {
    return callMethod.call(handler, methodName, event, ...args);
  });

  // TODO: remove this?
  ipcMainOn(`${handler.channel}.on` as MainOnChannels, (event, methodName, ...args: unknown[]) => {
    return callMethod.call(handler, methodName, event, ...args);
  });
}

export function registerAllIpcHandlers(handlers: BaseIpcHandler[]) {
  for (const handler of handlers) {
    registerHandler(handler);
  }
}
