import { ipcRenderer } from 'electron';

// Provide window.app so plugin-loading code (which checks process.type === 'renderer')
// can resolve the userData path without needing the main renderer's full preload.
window.app = {
  getPath: (name: string) => ipcRenderer.sendSync('getPath', name) as string,
  getAppPath: () => ipcRenderer.sendSync('getAppPath') as string,
  process: { platform: process.platform as NodeJS.Platform },
};
