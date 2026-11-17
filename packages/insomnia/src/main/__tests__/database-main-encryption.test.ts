import { generateKeySync, type KeyObject } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { mainDatabase as MainDatabase } from '../database.main';
import type { getLocalEncryptionKey as GetLocalEncryptionKey } from '../local-encryption-key';

const { nedbInit } = vi.hoisted(() => ({ nedbInit: vi.fn(async () => {}) }));

vi.mock('electron', () => ({
  default: {
    app: { getPath: () => '/user-data' },
    ipcMain: { handle: vi.fn() },
    BrowserWindow: { getAllWindows: () => [] },
  },
}));
vi.mock('insomnia-data/node', () => ({
  createNedbDatabase: (wrapper: (db: unknown, internals: unknown) => unknown) =>
    wrapper({ init: nedbInit }, { flushChangesImpl: vi.fn() }),
}));
vi.mock('../local-encryption-key', () => ({ getLocalEncryptionKey: vi.fn() }));

describe('mainDatabase.init()', () => {
  let mainDatabase: typeof MainDatabase;
  let getLocalEncryptionKey: typeof GetLocalEncryptionKey;

  beforeEach(async () => {
    vi.clearAllMocks();
    // The setup file already imported the real database.main, which this test replaces the key loading of
    vi.resetModules();
    ({ mainDatabase } = await import('../database.main'));
    ({ getLocalEncryptionKey } = await import('../local-encryption-key'));
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
});
