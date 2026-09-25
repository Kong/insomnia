import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  default: {
    app: {
      getPath: vi.fn(() => process.env['INSOMNIA_DATA_PATH']),
      relaunch: vi.fn(),
      exit: vi.fn(),
    },
  },
}));

import { restoreBackup } from '../backup';

describe('restoreBackup', () => {
  let dataPath: string;
  let originalDataPath: string | undefined;

  beforeEach(() => {
    dataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-backup-test-'));
    originalDataPath = process.env['INSOMNIA_DATA_PATH'];
    process.env['INSOMNIA_DATA_PATH'] = dataPath;
  });

  afterEach(() => {
    process.env['INSOMNIA_DATA_PATH'] = originalDataPath;
    fs.rmSync(dataPath, { recursive: true, force: true });
  });

  it('restores a .db file from a real backup version', async () => {
    const versionDir = path.join(dataPath, 'backups', '1.0.0');
    fs.mkdirSync(versionDir, { recursive: true });
    fs.writeFileSync(path.join(versionDir, 'insomnia.Request.db'), 'backed-up-content');

    await restoreBackup('1.0.0');

    expect(fs.readFileSync(path.join(dataPath, 'insomnia.Request.db'), 'utf8')).toBe('backed-up-content');
  });

  it('refuses a version that escapes the backups directory', async () => {
    const secretPath = path.join(dataPath, 'insomnia.Secret.db');
    fs.writeFileSync(secretPath, 'do-not-touch');

    await restoreBackup('../');

    expect(fs.readFileSync(secretPath, 'utf8')).toBe('do-not-touch');
  });

  it('refuses a deeply nested traversal version', async () => {
    fs.mkdirSync(path.join(dataPath, 'backups'), { recursive: true });

    await expect(restoreBackup('../../../../etc')).resolves.toBeUndefined();
  });
});
