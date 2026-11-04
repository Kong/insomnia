import { initDatabase, initServices } from 'insomnia-data';
import { servicesNodeImpl } from 'insomnia-data/node';
import { vi } from 'vitest';

// eslint-disable-next-line no-restricted-imports
import { v4Mock } from '../insomnia-data/__mocks__/uuid';
import { electronMock } from './src/__mocks__/electron';
import { nodeLibcurlMock } from './src/__mocks__/node-libcurl';
import { mainDatabase } from './src/main/database.main';
import { initRuntime } from './src/runtimes';
import { nodeRuntime } from './src/runtimes/runtime.node';

// Node 26 ships a global localStorage stub that shadows jsdom's implementation.
if (typeof window !== 'undefined' && !window.localStorage?.clear) {
  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, String(value)),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size;
      },
    },
  });
}


await initDatabase(mainDatabase, { inMemoryOnly: true }, true);
await initServices(servicesNodeImpl);
initRuntime(nodeRuntime);

// spread as named exports too, so `import { ipcMain, BrowserWindow, app } from 'electron'` resolves
vi.mock('electron', () => ({ default: electronMock, ...electronMock }));

vi.mock('uuid', () => ({
  v4: () => v4Mock(),
}));
vi.mock('node-libcurl', () => nodeLibcurlMock);

vi.mock('isomorphic-git', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...Object.assign({}, actual),
    push: vi.fn(),
    clone: vi.fn(),
  };
});
