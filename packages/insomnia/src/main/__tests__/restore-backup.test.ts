import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import type * as fsPromises from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { relaunch, exit } = vi.hoisted(() => ({ relaunch: vi.fn(), exit: vi.fn() }));

vi.mock('electron', () => ({
  default: { app: { getPath: vi.fn(), relaunch, exit } },
  app: { getPath: vi.fn(), relaunch, exit },
}));

// Make each copy take a moment, so a relaunch that doesn't wait for the copies
// runs before they finish (in the app, exit() would then kill them).
vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof fsPromises>();
  return {
    ...actual,
    copyFile: async (...args: Parameters<typeof actual.copyFile>) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return actual.copyFile(...args);
    },
  };
});

vi.mock('insomnia-data', () => ({ services: {} }));
vi.mock('~/main/updates', () => ({ getUpdateUrl: vi.fn() }));

import { restoreBackup } from '../backup';

describe('restoreBackup', () => {
  let dataPath: string;

  beforeEach(() => {
    dataPath = mkdtempSync(path.join(tmpdir(), 'insomnia-restore-'));
    process.env['INSOMNIA_DATA_PATH'] = dataPath;
  });

  afterEach(() => {
    delete process.env['INSOMNIA_DATA_PATH'];
    vi.clearAllMocks();
  });

  it('copies every backed up .db file before relaunching', async () => {
    const versionPath = path.join(dataPath, 'backups', '1.0.0');
    await mkdir(versionPath, { recursive: true });
    for (const name of ['insomnia.Request.db', 'insomnia.Workspace.db', 'insomnia.Environment.db']) {
      writeFileSync(path.join(versionPath, name), `backup of ${name}`);
    }
    writeFileSync(path.join(versionPath, 'notes.txt'), 'ignored');

    const copiedWhenExiting: string[] = [];
    exit.mockImplementation(() => {
      for (const name of ['insomnia.Request.db', 'insomnia.Workspace.db', 'insomnia.Environment.db']) {
        const target = path.join(dataPath, name);
        if (existsSync(target) && readFileSync(target, 'utf8') === `backup of ${name}`) {
          copiedWhenExiting.push(name);
        }
      }
    });

    await restoreBackup('1.0.0');

    expect(relaunch).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(copiedWhenExiting.sort()).toEqual([
      'insomnia.Environment.db',
      'insomnia.Request.db',
      'insomnia.Workspace.db',
    ]);
    expect(existsSync(path.join(dataPath, 'notes.txt'))).toBe(false);
  });
});
