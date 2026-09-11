import { ipcMainHandle, ipcMainOn } from '../ipc/electron';

export abstract class BaseIpcHandler {
  abstract channel: string;
}

const handlersByChannel = new Map<string, BaseIpcHandler>();

function dispatch(
  channel: string,
  methodName: string,
  event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent,
  ...args: unknown[]
) {
  const handler: any = handlersByChannel.get(channel);
  if (!handler) {
    throw new TypeError(`No IPC handler registered for channel "${channel}"`);
  }
  const method = handler[methodName as keyof typeof handler];
  if (typeof method !== 'function') {
    throw new TypeError(`Method ${methodName} is not a function`);
  }
  return method.call(handler, event.sender, ...args);
}

export function registerAllIpcHandlers(handlers: BaseIpcHandler[]) {
  for (const handler of handlers) {
    handlersByChannel.set(handler.channel, handler);
  }

  ipcMainHandle('main.invoke', (event, channel: string, methodName: string, ...args: unknown[]) => {
    return dispatch(channel, methodName, event, ...args);
  });

  // TODO: remove this?
  ipcMainOn('main.on', (event, channel: string, methodName: string, ...args: unknown[]) => {
    return dispatch(channel, methodName, event, ...args);
  });
}
