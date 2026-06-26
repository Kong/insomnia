import type { BrowserWindow as ElectronBrowserWindow } from 'electron';

export const browserWindows = new Map<'Insomnia' | 'HiddenBrowserWindow', ElectronBrowserWindow>();

export function getMainWindow(): ElectronBrowserWindow | null {
  return browserWindows.get('Insomnia') ?? null;
}
