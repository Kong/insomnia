import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { vi } from 'vitest';

const RANDOM_STRING = Math.random().toString().replace('.', '');

const remote = {
  app: {
    getPath(name: string) {
      const dir = path.join(os.tmpdir(), `insomnia-tests-${RANDOM_STRING}`, name);
      fs.mkdirSync(dir, { recursive: true });
      return dir;
    },

    getLocale() {
      return 'en-US';
    },

    exit: vi.fn(),
  },
  net: {
    request() {
      const req = new EventEmitter();

      // @ts-expect-error -- TSCONVERSION appears to be genuine
      req.end = function() {};

      return req;
    },
  },
  BrowserWindow: {
    getAllWindows() {
      return [];
    },

    getFocusedWindow() {
      return {
        getContentBounds() {
          return {
            width: 1900,
            height: 1060,
          };
        },
      };
    },
  },
  screen: {
    getPrimaryDisplay() {
      return {
        workAreaSize: {
          width: 1920,
          height: 1080,
        },
      };
    },
  },
};

const dialog = {
  showErrorBox: vi.fn(),
};

export const electronMock = {
  ...remote,
  remote,
  dialog,
  ipcMain: {
    on: vi.fn(),

    once() {},
  },
  ipcRenderer: {
    on: vi.fn(),
    removeAllListeners: vi.fn(),

    once() {},

    send: vi.fn(),
  },
  shell: {
    openExternal: vi.fn(),
  },
  clipboard: {
    writeText: vi.fn(),
    readText: vi.fn(),
    clear: vi.fn(),
  },
};
