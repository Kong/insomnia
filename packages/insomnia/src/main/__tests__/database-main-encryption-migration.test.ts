import { generateKeySync } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { mainDatabase as MainDatabase } from '../database.main';
import type ElectronStorage from '../electron-storage';
import { LOCAL_ENCRYPTION_KEY_STORAGE_KEY } from '../local-encryption-key';

// Starting the real main database on a copy of the plaintext legacy fixture: the real key provider, ElectronStorage and
// NeDB, with only the OS protection (safeStorage) replaced. Every launch loads the modules again, like a new process.

const { safeStorage } = vi.hoisted(() => ({
  safeStorage: {
    isAsyncEncryptionAvailable: vi.fn(),
    encryptStringAsync: vi.fn(),
    decryptStringAsync: vi.fn(),
  },
}));

vi.mock('electron', () => {
  const electron = {
    app: { getPath: () => '/not-used', relaunch: vi.fn(), exit: vi.fn(), quit: vi.fn() },
    ipcMain: { handle: vi.fn() },
    BrowserWindow: { getAllWindows: () => [] },
    dialog: { showMessageBox: vi.fn() },
    safeStorage,
  };
  return { default: electron, ...electron };
});

const fixtureDir = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'insomnia-smoke-test',
  'fixtures',
  'insomnia-legacy-db',
);

const useWorkingSafeStorage = () => {
  safeStorage.isAsyncEncryptionAvailable.mockReset().mockResolvedValue(true);
  safeStorage.encryptStringAsync.mockReset().mockImplementation(async (text: string) => Buffer.from(`os:${text}`));
  safeStorage.decryptStringAsync.mockReset().mockImplementation(async (encrypted: Buffer) => ({
    result: encrypted.toString().slice(3),
    shouldReEncrypt: false,
  }));
};

// Every launch loads the application modules again, which is slow on a loaded machine
describe('the first launch of a database that is not encrypted yet', { timeout: 30_000 }, () => {
  let dataPath: string;
  let secrets: string[];
  const bearerToken = 'a-bearer-token-in-the-fixture-copy';

  const keyFile = () => path.join(dataPath, 'localStorage', LOCAL_ENCRYPTION_KEY_STORAGE_KEY);
  const databaseText = () =>
    fs
      .readdirSync(dataPath)
      .filter(file => /^insomnia\..+\.db$/.test(file))
      .map(file => fs.readFileSync(path.join(dataPath, file), 'utf8'))
      .join('\n');
  const secretsOnDisk = () => secrets.filter(secret => databaseText().includes(secret));

  /** Starts the main database the way the app does, in a fresh module registry. `beforeInit` can break something first. */
  const launch = async (beforeInit?: (storage: ElectronStorage) => void) => {
    vi.resetModules();
    const { getElectronStorage, initElectronStorage } = await import('../electron-storage');
    initElectronStorage(dataPath);
    beforeInit?.(getElectronStorage());
    process.env['INSOMNIA_DATA_PATH'] = dataPath;
    const { initDatabase } = await import('insomnia-data');
    const { mainDatabase } = (await import('../database.main')) as { mainDatabase: typeof MainDatabase };
    await initDatabase(mainDatabase);
    return mainDatabase;
  };

  const expectDataReadable = async (database: typeof MainDatabase) => {
    expect((await database.findOne<any>('Request', { _id: 'req_seeded' }))?.authentication.token).toBe(bearerToken);
    const versions = await database.find<any>('RequestVersion', {});
    expect(versions.map(version => version.compressedRequest).filter(value => secrets.includes(value))).toHaveLength(2);
  };

  beforeEach(() => {
    dataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-main-migration-'));
    fs.cpSync(fixtureDir, dataPath, { recursive: true });
    fs.appendFileSync(
      path.join(dataPath, 'insomnia.Request.db'),
      `${JSON.stringify({ _id: 'req_seeded', type: 'Request', parentId: 'wrk_seeded', name: 'seeded', authentication: { type: 'bearer', token: bearerToken } })}\n`,
    );
    const versions = fs
      .readFileSync(path.join(dataPath, 'insomnia.RequestVersion.db'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line).compressedRequest);
    secrets = [bearerToken, ...versions];
    expect(versions).toHaveLength(2);

    useWorkingSafeStorage();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env['INSOMNIA_DATA_PATH'];
    fs.rmSync(dataPath, { recursive: true, force: true });
  });

  it('has the secrets in plaintext before the first launch, and no key', () => {
    expect(secretsOnDisk()).toEqual(secrets);
    expect(fs.existsSync(keyFile())).toBe(false);
  });

  it('writes the key to disk before any datastore is encrypted, and a later launch reads everything with it', async () => {
    let onDiskWhenKeyWasSaved: string[] | undefined;
    const database = await launch(storage => {
      const setItemDurable = storage.setItemDurable.bind(storage);
      vi.spyOn(storage, 'setItemDurable').mockImplementation(async (key, value) => {
        await setItemDurable(key, value);
        onDiskWhenKeyWasSaved = secretsOnDisk();
      });
    });

    expect(onDiskWhenKeyWasSaved).toEqual(secrets);
    expect(fs.existsSync(keyFile())).toBe(true);
    expect(secretsOnDisk()).toEqual([]);
    await expectDataReadable(database);

    const later = await launch();
    expect(secretsOnDisk()).toEqual([]);
    await expectDataReadable(later);
  });

  it.each([
    [
      'protected',
      () => {
        safeStorage.encryptStringAsync.mockRejectedValue(new Error('The OS refused to encrypt'));
      },
    ],
    [
      'saved',
      (storage: ElectronStorage) => {
        vi.spyOn(storage, 'setItemDurable').mockRejectedValueOnce(new Error('The disk is full'));
      },
    ],
    [
      'verified',
      () => {
        const otherKey = generateKeySync('aes', { length: 256 });
        safeStorage.decryptStringAsync.mockResolvedValueOnce({
          result: JSON.stringify(otherKey.export({ format: 'jwk' })),
          shouldReEncrypt: false,
        });
      },
    ],
  ])(
    'encrypts nothing when the new key cannot be %s, keeps every secret readable, and encrypts on the next launch',
    async (_step, breakIt) => {
      const database = await launch(storage => breakIt(storage));

      expect(secretsOnDisk()).toEqual(secrets);
      expect(fs.existsSync(keyFile())).toBe(false);
      await expectDataReadable(database);

      useWorkingSafeStorage();
      const next = await launch();

      expect(fs.existsSync(keyFile())).toBe(true);
      expect(secretsOnDisk()).toEqual([]);
      await expectDataReadable(next);
    },
  );
});
