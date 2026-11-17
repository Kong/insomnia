import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { getElectronStorage as GetElectronStorage } from '../../electron-storage';
import { LOCAL_ENCRYPTION_KEY_STORAGE_KEY } from '../../local-encryption-key';
import type { assertStorageKeyAllowedForRenderer as AssertStorageKeyAllowedForRenderer } from '../reserved-storage-keys';

const { handlers } = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, ...args: any[]) => any>(),
}));
vi.mock('../electron', () => ({
  ipcMainHandle: (channel: string, handler: (event: unknown, ...args: any[]) => any) => {
    handlers.set(channel, handler);
  },
}));
vi.mock('electron', () => ({ safeStorage: { isEncryptionAvailable: () => false } }));

const KEY_FILE_CONTENTS = '{"version":1,"ciphertext":"protected-key"}';

describe('storage keys the renderer must not reach', () => {
  let dataPath: string;
  let keyFile: string;
  let getElectronStorage: typeof GetElectronStorage;
  let assertStorageKeyAllowedForRenderer: typeof AssertStorageKeyAllowedForRenderer;

  beforeAll(async () => {
    // The setup file already loaded the secret storage module, with the real ipcMainHandle. Load everything again.
    vi.resetModules();
    const storageModule = await import('../../electron-storage');
    getElectronStorage = storageModule.getElectronStorage;
    ({ assertStorageKeyAllowedForRenderer } = await import('../reserved-storage-keys'));

    dataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-reserved-keys-'));
    storageModule.initElectronStorage(dataPath);
    keyFile = path.join(dataPath, 'localStorage', LOCAL_ENCRYPTION_KEY_STORAGE_KEY);
    (await import('../electron-storage')).registerElectronStorageHandlers();
    (await import('../secret-storage')).registerSecretStorageHandlers();
  });
  afterAll(() => {
    fs.rmSync(dataPath, { recursive: true, force: true });
  });
  beforeEach(() => {
    fs.rmSync(keyFile, { force: true });
    fs.writeFileSync(keyFile, KEY_FILE_CONTENTS);
  });

  const invoke = (channel: string, ...args: unknown[]) =>
    Promise.resolve().then(() => handlers.get(channel)!({}, ...args));
  const isBlocked = (key: string) => {
    try {
      assertStorageKeyAllowedForRenderer(key);
      return false;
    } catch {
      return true;
    }
  };

  describe('assertStorageKeyAllowedForRenderer()', () => {
    it('blocks the key itself', () => {
      expect(isBlocked(LOCAL_ENCRYPTION_KEY_STORAGE_KEY)).toBe(true);
    });

    it.each([
      ['another case', 'FIELDENCRYPTIONKEY'],
      ['a mixed case', 'FieldEncryptionkey'],
      ['trailing dots', 'fieldEncryptionKey..'],
      ['trailing spaces', 'fieldEncryptionKey  '],
      ['trailing dots and spaces', 'fieldEncryptionKey. .'],
      ['an alternate data stream', 'fieldEncryptionKey:stream'],
      ['the default data stream', 'fieldEncryptionKey::$DATA'],
      ['a Unicode case folding (Kelvin sign)', 'fieldEncryption\u212Aey'],
      ['a compatibility form (full-width)', 'ｆieldEncryptionKey'],
    ])('blocks the key under %s, which a file system may treat as the same file', (_name, key) => {
      expect(isBlocked(key)).toBe(true);
    });

    it('blocks another name of the same file, even when its name looks harmless (hard link)', () => {
      fs.linkSync(keyFile, path.join(dataPath, 'localStorage', 'innocent-name'));
      try {
        expect(isBlocked('innocent-name')).toBe(true);
      } finally {
        fs.rmSync(path.join(dataPath, 'localStorage', 'innocent-name'));
      }
    });

    it('blocks the key name when the file does not exist yet, so that a renderer cannot plant one', () => {
      fs.rmSync(keyFile);
      expect(isBlocked(LOCAL_ENCRYPTION_KEY_STORAGE_KEY)).toBe(true);
      expect(isBlocked('FIELDENCRYPTIONKEY')).toBe(true);
    });

    it.each([
      'konnectPat',
      'vault_acct_123',
      'current-oauth-session-id',
      'GIT_CREDENTIALS_MIGRATION',
      'fieldEncryptionKey2',
      'xfieldEncryptionKey',
      'field-encryption-key',
      'fieldEncryption',
      'bounds',
    ])('allows the other key %j', key => {
      expect(isBlocked(key)).toBe(false);
    });

    it('rejects the key, rather than letting it through, when the file cannot be inspected', () => {
      vi.spyOn(fs, 'statSync').mockImplementation(() => {
        throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      });
      expect(isBlocked('innocent-name')).toBe(true);
      vi.restoreAllMocks();
    });

    it('does not take every key for the key file on a file system that reports inode 0 for all files', () => {
      fs.writeFileSync(path.join(dataPath, 'localStorage', 'bounds'), '1');
      vi.spyOn(fs, 'statSync').mockReturnValue({ dev: 1n, ino: 0n } as never);
      expect(isBlocked('bounds')).toBe(false);
      vi.restoreAllMocks();
    });

    it('does not block an unrelated file that happens to exist', () => {
      fs.writeFileSync(path.join(dataPath, 'localStorage', 'other'), 'x');
      expect(isBlocked('other')).toBe(false);
      fs.rmSync(path.join(dataPath, 'localStorage', 'other'));
    });

    it('rejects a key that is not a string instead of letting it through', () => {
      expect(isBlocked(undefined as never)).toBe(true);
      expect(isBlocked({ toString: () => 'x' } as never)).toBe(true);
    });
  });

  describe('the renderer-facing handlers', () => {
    it.each([
      ['electronStorage.getItem', [LOCAL_ENCRYPTION_KEY_STORAGE_KEY]],
      ['electronStorage.setItem', [LOCAL_ENCRYPTION_KEY_STORAGE_KEY, 'overwritten']],
      ['secretStorage.getSecret', [LOCAL_ENCRYPTION_KEY_STORAGE_KEY]],
      ['secretStorage.setSecret', [LOCAL_ENCRYPTION_KEY_STORAGE_KEY, 'overwritten']],
      ['secretStorage.deleteSecret', [LOCAL_ENCRYPTION_KEY_STORAGE_KEY]],
    ])('%s rejects the key, and the key file is left alone', async (channel, args) => {
      await expect(invoke(channel, ...args)).rejects.toThrow('not allowed');
      await new Promise(resolve => setTimeout(resolve, 150)); // a buffered write would have landed by now
      expect(fs.readFileSync(keyFile, 'utf8')).toBe(KEY_FILE_CONTENTS);
    });

    it.each([
      ['electronStorage.setItem', ['FIELDENCRYPTIONKEY', 'overwritten']],
      ['secretStorage.deleteSecret', ['fieldEncryptionKey::$DATA']],
      ['secretStorage.setSecret', ['fieldEncryptionKey.', 'overwritten']],
    ])('%s rejects a variant of the key name too', async (channel, args) => {
      await expect(invoke(channel, ...args)).rejects.toThrow('not allowed');
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(fs.readFileSync(keyFile, 'utf8')).toBe(KEY_FILE_CONTENTS);
    });

    it('still serves the other keys', async () => {
      await invoke('electronStorage.setItem', 'current-oauth-session-id', 'session');
      expect(await invoke('electronStorage.getItem', 'current-oauth-session-id')).toBe('session');

      await invoke('secretStorage.setSecret', 'konnectPat', 'pat');
      expect(await invoke('secretStorage.getSecret', 'konnectPat')).toBe('pat');
      await invoke('secretStorage.deleteSecret', 'konnectPat');
      expect(await invoke('secretStorage.getSecret', 'konnectPat')).toBeNull();
    });

    it('leaves the main process able to use the key through ElectronStorage', async () => {
      const storage = getElectronStorage();
      await storage.setItemDurable(LOCAL_ENCRYPTION_KEY_STORAGE_KEY, { version: 1, ciphertext: 'new' });
      expect(storage.getItemStrict(LOCAL_ENCRYPTION_KEY_STORAGE_KEY)).toEqual({ version: 1, ciphertext: 'new' });
      storage.deleteItem(LOCAL_ENCRYPTION_KEY_STORAGE_KEY);
      expect(fs.existsSync(keyFile)).toBe(false);
    });
  });
});
