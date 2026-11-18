import { generateKeySync, type KeyObject } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { mainDatabase as MainDatabase } from '../database.main';
import type {
  createFieldEncryptionController as CreateFieldEncryptionController,
  provideFieldEncryptionController as ProvideFieldEncryptionController,
} from '../ipc/field-encryption';
import type { getLocalEncryptionKey as GetLocalEncryptionKey } from '../local-encryption-key';

const { nedbInit, refreshFieldDecryptionFailures, resetFieldDecryptionFailures } = vi.hoisted(() => ({
  nedbInit: vi.fn(async () => {}),
  refreshFieldDecryptionFailures: vi.fn(async () => []),
  resetFieldDecryptionFailures: vi.fn(async () => 0),
}));

vi.mock('electron', () => ({
  default: {
    app: { getPath: () => '/user-data' },
    ipcMain: { handle: vi.fn() },
    BrowserWindow: { getAllWindows: () => [] },
  },
}));
vi.mock('insomnia-data/node', () => ({
  createNedbDatabase: (wrapper: (db: unknown, internals: unknown) => unknown) =>
    wrapper(
      { init: nedbInit },
      { flushChangesImpl: vi.fn(), refreshFieldDecryptionFailures, resetFieldDecryptionFailures },
    ),
}));
vi.mock('../local-encryption-key', () => ({ getLocalEncryptionKey: vi.fn(), localEncryptionKeyFileExists: vi.fn() }));
vi.mock('../ipc/field-encryption', () => ({
  confirmLocalKeyReset: vi.fn(),
  createFieldEncryptionController: vi.fn(() => ({})),
  provideFieldEncryptionController: vi.fn(),
  restartApp: vi.fn(),
  setAsideKey: vi.fn(),
}));

describe('mainDatabase.init()', () => {
  let mainDatabase: typeof MainDatabase;
  let getLocalEncryptionKey: typeof GetLocalEncryptionKey;
  let createFieldEncryptionController: typeof CreateFieldEncryptionController;
  let provideFieldEncryptionController: typeof ProvideFieldEncryptionController;

  beforeEach(async () => {
    vi.clearAllMocks();
    // The setup file already imported the real database.main, which this test replaces the key loading of
    vi.resetModules();
    ({ mainDatabase } = await import('../database.main'));
    ({ getLocalEncryptionKey } = await import('../local-encryption-key'));
    ({ createFieldEncryptionController, provideFieldEncryptionController } = await import('../ipc/field-encryption'));
  });

  it('passes the local encryption key to the database', async () => {
    const key = generateKeySync('aes', { length: 256 });
    vi.mocked(getLocalEncryptionKey).mockResolvedValue(key);

    await mainDatabase.init();

    expect(nedbInit).toHaveBeenCalledTimes(1);
    expect(nedbInit).toHaveBeenCalledWith(expect.objectContaining({ fieldEncryptionKey: key }), false);
  });

  it('opens the database without encryption when there is no usable key (degraded mode)', async () => {
    let noKey: KeyObject | undefined;
    vi.mocked(getLocalEncryptionKey).mockResolvedValue(noKey);

    await mainDatabase.init();

    expect(nedbInit).toHaveBeenCalledTimes(1);
    expect(nedbInit.mock.calls[0]).toEqual([expect.objectContaining({ fieldEncryptionKey: undefined }), false]);
  });

  it('neither loads nor creates a key for an in-memory instance', async () => {
    await mainDatabase.init({ inMemoryOnly: true });

    expect(getLocalEncryptionKey).not.toHaveBeenCalled();
    expect(nedbInit).toHaveBeenCalledWith(
      expect.objectContaining({ inMemoryOnly: true, fieldEncryptionKey: undefined }),
      false,
    );
  });

  it('loads the key before it initializes the database, so no datastore is written before the key is saved', async () => {
    vi.mocked(getLocalEncryptionKey).mockResolvedValue(generateKeySync('aes', { length: 256 }));

    await mainDatabase.init();

    expect(vi.mocked(getLocalEncryptionKey).mock.invocationCallOrder[0]).toBeLessThan(
      nedbInit.mock.invocationCallOrder[0],
    );
  });

  it('does not initialize the database when loading the key throws', async () => {
    vi.mocked(getLocalEncryptionKey).mockRejectedValue(new Error('unexpected'));

    await expect(mainDatabase.init()).rejects.toThrow('unexpected');
    expect(nedbInit).not.toHaveBeenCalled();
  });

  describe('what the renderer is told about encryption', () => {
    const controllerDeps = () => vi.mocked(createFieldEncryptionController).mock.calls[0][0];

    it('gives the controller to the IPC handler, and the database is not degraded when there is a key', async () => {
      const key = generateKeySync('aes', { length: 256 });
      vi.mocked(getLocalEncryptionKey).mockResolvedValue(key);

      await mainDatabase.init();

      expect(provideFieldEncryptionController).toHaveBeenCalledTimes(1);
      expect(controllerDeps().key).toBe(key);
      expect(controllerDeps().refreshFailures).toBe(refreshFieldDecryptionFailures);
      expect(controllerDeps().resetFailures).toBe(resetFieldDecryptionFailures);
    });

    it('is degraded when there is no usable key', async () => {
      let noKey: KeyObject | undefined;
      vi.mocked(getLocalEncryptionKey).mockResolvedValue(noKey);

      await mainDatabase.init();

      expect(controllerDeps().key).toBeUndefined();
    });

    it('gives the handler nothing for an in-memory instance, which has no key and is not degraded', async () => {
      await mainDatabase.init({ inMemoryOnly: true });

      expect(provideFieldEncryptionController).not.toHaveBeenCalled();
    });
  });
});
