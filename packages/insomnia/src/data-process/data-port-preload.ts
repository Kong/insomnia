import type { IpcRendererEvent } from 'electron';
import { ipcRenderer } from 'electron';

import { type InvokeFn, PortRpc } from './port-rpc';

/**
 * Wires up a PortRpc instance to the data-process IPC channel and returns
 * the invoke function to expose via contextBridge / window.
 *
 * @param context - Identifies the caller in error/log messages (e.g. 'preload', 'hidden-window-preload').
 */
export function attachDataPortRpc(context: string): InvokeFn {
  const rpc = new PortRpc();

  ipcRenderer.on('data-process.port', (event: IpcRendererEvent) => {
    const port = event.ports[0];
    if (port) {
      rpc.attach(
        m => port.postMessage(m),
        h => {
          port.onmessage = (e: MessageEvent) => h(e.data);
          port.start();
        },
      );
      console.log(`[${context}] data-process port received and attached`);
    } else {
      console.warn(`[${context}] data-process.port event received but no port transferred`);
    }
  });

  ipcRenderer.on('data-process.restarting', () => {
    console.warn(`[${context}] data-process restarting – invalidating RPC`);
    rpc.invalidate('data-process restarting');
  });

  ipcRenderer.invoke('data-process.request-port').catch((e: unknown) => {
    console.error(`[${context}] failed to request data-process port:`, e);
  });

  return rpc.invoke;
}
