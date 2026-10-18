import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const relaunch = vi.fn();
const exit = vi.fn();

vi.mock('electron', () => ({
  default: { app: { relaunch: (...a: any[]) => relaunch(...a), exit: (...a: any[]) => exit(...a), getPath: () => '' }, net: { fetch: vi.fn() } },
}));
vi.mock('insomnia-data', () => ({ services: { settings: { get: vi.fn() } } }));
vi.mock('~/main/updates', () => ({ getUpdateUrl: vi.fn() }));

import { restoreBackup } from '../backup';

describe('restoreBackup version containment', () => {
  let root: string;
  let dataPath: string;
  const originalEnv = process.env['INSOMNIA_DATA_PATH'];

  beforeEach(async () => {
    root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'insomnia-backup-'));
    dataPath = path.join(root, 'data');
    await fs.promises.mkdir(path.join(dataPath, 'backups', '1.0.0'), { recursive: true });
    await fs.promises.writeFile(path.join(dataPath, 'backups', '1.0.0', 'good.db'), 'good');
    // a directory outside backups/ holding an attacker controlled database
    await fs.promises.mkdir(path.join(root, 'evil'));
    await fs.promises.writeFile(path.join(root, 'evil', 'evil.db'), 'evil');
    await fs.promises.mkdir(path.join(dataPath, 'sibling'));
    await fs.promises.writeFile(path.join(dataPath, 'sibling', 'sib.db'), 'sib');
    process.env['INSOMNIA_DATA_PATH'] = dataPath;
    relaunch.mockClear();
    exit.mockClear();
  });

  afterEach(async () => {
    if (originalEnv === undefined) {
      delete process.env['INSOMNIA_DATA_PATH'];
    } else {
      process.env['INSOMNIA_DATA_PATH'] = originalEnv;
    }
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  it('restores a legitimate version', async () => {
    await restoreBackup('1.0.0');
    await vi.waitFor(() => expect(fs.readFileSync(path.join(dataPath, 'good.db'), 'utf8')).toBe('good'));
    expect(relaunch).toHaveBeenCalled();
  });

  it.each(['../../evil', '../../../evil', '..', '.', '', '../sibling', '1.0.0/../../sibling', path.join(os.tmpdir(), 'x'), '1.0.0\0'])(
    'rejects version %j and copies nothing into the data dir',
    async version => {
      await expect(restoreBackup(version)).rejects.toThrow();
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(fs.existsSync(path.join(dataPath, 'evil.db'))).toBe(false);
      expect(fs.existsSync(path.join(dataPath, 'sib.db'))).toBe(false);
      expect(fs.existsSync(path.join(dataPath, 'backups', 'evil.db'))).toBe(false);
      expect(relaunch).not.toHaveBeenCalled();
    },
  );

  it('rejects an absolute path to a directory outside backups', async () => {
    await expect(restoreBackup(path.join(root, 'evil'))).rejects.toThrow();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(fs.existsSync(path.join(dataPath, 'evil.db'))).toBe(false);
  });
});
