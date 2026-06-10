import { randomUUID } from 'node:crypto';

import { ipcMain } from 'electron';

import { getMainWindow } from './window-utils';

const promptPendingRequests = new Map<string, (value: string | null) => void>();

export function requestPromptFromRenderer(options: {
  title: string;
  label?: string;
  defaultValue?: string;
}): Promise<string | null> {
  const mainWindow = getMainWindow();
  if (!mainWindow) {
    return Promise.resolve(null);
  }
  const id = randomUUID();
  return new Promise(resolve => {
    const timeout = setTimeout(() => {
      promptPendingRequests.delete(id);
      resolve(null);
    }, 60_000);
    promptPendingRequests.set(id, value => {
      clearTimeout(timeout);
      resolve(value);
    });
    mainWindow.webContents.send('ui.prompt', id, options);
  });
}

ipcMain.on('ui.promptResult', (event, { id, value }: { id: string; value: string | null }) => {
  if (event.sender !== getMainWindow()?.webContents) {
    return;
  }
  const resolve = promptPendingRequests.get(id);
  if (!resolve) {
    return;
  }
  promptPendingRequests.delete(id);
  resolve(value);
});
