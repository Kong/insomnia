import { ipcRenderer } from 'electron';

import { attachDataPortRpc } from './data-process/data-port-preload';

window.app = {
  getPath: (name: string) => ipcRenderer.sendSync('getPath', name) as string,
  getAppPath: () => ipcRenderer.sendSync('getAppPath') as string,
  process: { platform: process.platform as NodeJS.Platform },
};

window.invokeDataPort = attachDataPortRpc('plugin-window-preload');
// Bridge plugin UI calls to the main renderer window via IPC.
// The plugin window has no visible DOM; these methods forward to the main renderer.
window.showAlert = (options?: Record<string, any>) => {
  ipcRenderer.send('plugins.uiAlert', options ?? {});
};

window.showWrapper = (options?: Record<string, any>) => {
  ipcRenderer.send('plugins.uiDialog', options ?? {});
};

window.showPrompt = (options?: Record<string, any>) => {
  const { onComplete, onHide, ...serializableOptions } = options ?? {};
  ipcRenderer.invoke('plugins.uiPrompt', serializableOptions).then((value: string | null) => {
    if (value !== null && value !== undefined) {
      onComplete?.(value);
    }
    onHide?.();
  });
};

window.dialog = {
  showSaveDialog: (opts: any) => ipcRenderer.invoke('showSaveDialog', opts),
  showOpenDialog: (opts: any) => ipcRenderer.invoke('showOpenDialog', opts),
};

window.clipboard = {
  readText: () => ipcRenderer.sendSync('readText') as string,
  writeText: (text: string) => {
    ipcRenderer.send('writeText', text);
  },
  clear: () => {
    ipcRenderer.send('clear');
  },
};
