import { createSecretKey, generateKeySync } from 'node:crypto';
import { hostname } from 'node:os';

import { getFieldEncryptionKeyHost } from 'insomnia-data/node';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { registerAllIpcHandlers as RegisterAllIpcHandlers } from '../base-ipc-handler';
import type * as FieldEncryptionModule from '../field-encryption';
import {
  type confirmLocalKeyReset as ConfirmLocalKeyReset,
  createFieldEncryptionController,
  type FieldEncryptionControllerDeps,
} from '../field-encryption';

const { fromWebContents, ipcMainHandle } = vi.hoisted(() => ({ fromWebContents: vi.fn(), ipcMainHandle: vi.fn() }));
vi.mock('electron', () => ({
  app: { relaunch: vi.fn(), exit: vi.fn() },
  BrowserWindow: { fromWebContents },
  dialog: {},
}));
vi.mock('../electron', () => ({ ipcMainHandle }));

const localKey = generateKeySync('aes', { length: 256 });

const failure = (overrides: Partial<{ type: string; _id: string; path: string }> = {}) => ({
  type: 'Request',
  _id: 'req_1',
  path: 'authentication.password',
  ...overrides,
});

const setup = (overrides: Partial<FieldEncryptionControllerDeps> = {}) => {
  const deps: FieldEncryptionControllerDeps = {
    key: localKey,
    refreshFailures: vi.fn(async () => [failure()]),
    resetFailures: vi.fn(async () => 1),
    findDocumentWithAncestors: vi.fn(async () => [{ name: 'My request' }, { name: 'My workspace' }]),
    keyFileExists: vi.fn(() => true),
    confirmResetKey: vi.fn(async () => true),
    setAsideKey: vi.fn(async () => 'fieldEncryptionKey.bak-1'),
    restart: vi.fn(),
    ...overrides,
  };
  return { deps, controller: createFieldEncryptionController(deps) };
};

describe('field encryption controller', () => {
  describe('getStatus()', () => {
    it('is ok when nothing failed', async () => {
      const { controller } = setup({ refreshFailures: vi.fn(async () => []) });
      expect(await controller.getStatus()).toEqual({ kind: 'ok' });
    });

    it('lists the failed fields with the name of their document', async () => {
      const { controller } = setup();
      expect(await controller.getStatus()).toEqual({
        kind: 'decryptionFailed',
        failures: [{ ...failure(), label: 'My request' }],
      });
    });

    it('checks the report against the current data every time it is asked', async () => {
      const refreshFailures = vi
        .fn()
        .mockResolvedValueOnce([failure(), failure({ _id: 'req_2' })])
        .mockResolvedValueOnce([failure({ _id: 'req_2' })]);
      const { controller } = setup({ refreshFailures });

      expect(await controller.getStatus()).toMatchObject({ failures: [{ _id: 'req_1' }, { _id: 'req_2' }] });
      expect(await controller.getStatus()).toMatchObject({ failures: [{ _id: 'req_2' }] });
    });

    it('labels a document without a name with the nearest ancestor that has one', async () => {
      const { controller } = setup({
        findDocumentWithAncestors: vi.fn(async () => [
          {},
          { name: '  ' },
          { name: 'The request' },
          { name: 'Workspace' },
        ]),
      });
      expect(await controller.getStatus()).toMatchObject({ failures: [{ label: 'The request' }] });
    });

    it('falls back to the type and id when no name is known, or the document cannot be found', async () => {
      const { controller } = setup({ findDocumentWithAncestors: vi.fn(async () => []) });
      expect(await controller.getStatus()).toMatchObject({ failures: [{ label: 'Request req_1' }] });
    });

    it('still lists the field, under its type and id, when the name of its document cannot be looked up', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { controller } = setup({
        findDocumentWithAncestors: vi.fn(async () => {
          throw new Error('initModel failed');
        }),
      });

      expect(await controller.getStatus()).toEqual({
        kind: 'decryptionFailed',
        failures: [{ ...failure(), label: 'Request req_1' }],
      });
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it('loses only the name of the document whose lookup failed, not the others', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const { controller } = setup({
        refreshFailures: vi.fn(async () => [failure(), failure({ _id: 'req_2' })]),
        findDocumentWithAncestors: vi.fn(async (_type: string, id: string) => {
          if (id === 'req_1') {
            throw new Error('initModel failed');
          }
          return [{ name: 'Second request' }];
        }),
      });

      expect(await controller.getStatus()).toMatchObject({
        failures: [
          { _id: 'req_1', label: 'Request req_1' },
          { _id: 'req_2', label: 'Second request' },
        ],
      });
    });

    it('looks a document up once, however many of its fields failed', async () => {
      const { controller, deps } = setup({
        refreshFailures: vi.fn(async () => [
          failure(),
          failure({ path: 'authentication.token' }),
          failure({ _id: 'req_2' }),
        ]),
      });
      await controller.getStatus();
      expect(deps.findDocumentWithAncestors).toHaveBeenCalledTimes(2);
    });

    it('is degraded when the database runs without the key, without looking at the report', async () => {
      const { controller, deps } = setup({ key: undefined });
      expect(await controller.getStatus()).toEqual({ kind: 'degraded', canResetKey: true });
      expect(deps.refreshFailures).not.toHaveBeenCalled();
    });

    it('says that the key cannot be reset when there is no key file, which is the case when it could not be created', async () => {
      const { controller } = setup({ key: undefined, keyFileExists: vi.fn(() => false) });
      expect(await controller.getStatus()).toEqual({ kind: 'degraded', canResetKey: false });
    });
  });

  describe('resetFailedFields()', () => {
    it('resets, reports how many fields were cleared, and the dialog does not come back', async () => {
      const { controller, deps } = setup();
      expect(await controller.resetFailedFields()).toBe(1);
      expect(deps.resetFailures).toHaveBeenCalledTimes(1);
      expect(await controller.getStatus()).toEqual({ kind: 'ok' });
    });

    it('does not mark the dialog as decided when the reset fails', async () => {
      const { controller } = setup({ resetFailures: vi.fn().mockRejectedValue(new Error('disk full')) });
      await expect(controller.resetFailedFields()).rejects.toThrow('disk full');
      expect(await controller.getStatus()).toMatchObject({ kind: 'decryptionFailed' });
    });

    it('refuses while the database runs without encryption', async () => {
      const { controller, deps } = setup({ key: undefined });
      await expect(controller.resetFailedFields()).rejects.toThrow();
      expect(deps.resetFailures).not.toHaveBeenCalled();
    });
  });

  describe('dismiss()', () => {
    it('keeps the dialog away for the rest of the run, without changing anything', async () => {
      const { controller, deps } = setup();
      await controller.dismiss();
      expect(await controller.getStatus()).toEqual({ kind: 'ok' });
      expect(deps.resetFailures).not.toHaveBeenCalled();
    });

    it('does the same in degraded mode', async () => {
      const { controller } = setup({ key: undefined });
      await controller.dismiss();
      expect(await controller.getStatus()).toEqual({ kind: 'ok' });
    });
  });

  describe('resetKey()', () => {
    it('asks the user, then sets the key aside, then restarts, in that order', async () => {
      const order: string[] = [];
      const { controller } = setup({
        key: undefined,
        confirmResetKey: vi.fn(async () => {
          order.push('confirm');
          return true;
        }),
        setAsideKey: vi.fn(async () => {
          order.push('set aside');
        }),
        restart: vi.fn(() => {
          order.push('restart');
        }),
      });
      expect(await controller.resetKey()).toBe(true);
      expect(order).toEqual(['confirm', 'set aside', 'restart']);
    });

    it('does nothing when the user declines, so the renderer cannot reset the key on its own', async () => {
      const { controller, deps } = setup({ key: undefined, confirmResetKey: vi.fn(async () => false) });
      expect(await controller.resetKey()).toBe(false);
      expect(deps.setAsideKey).not.toHaveBeenCalled();
      expect(deps.restart).not.toHaveBeenCalled();
    });

    it('passes the window that asked, so the question is shown on top of it', async () => {
      const { controller, deps } = setup({ key: undefined });
      const sender = {} as never;
      await controller.resetKey(sender);
      expect(deps.confirmResetKey).toHaveBeenCalledWith(sender);
    });

    it('is refused when there is no key file, without asking the user', async () => {
      const { controller, deps } = setup({ key: undefined, keyFileExists: vi.fn(() => false) });
      await expect(controller.resetKey()).rejects.toThrow('no encryption key file');
      expect(deps.confirmResetKey).not.toHaveBeenCalled();
      expect(deps.setAsideKey).not.toHaveBeenCalled();
    });

    it('does not restart when the key could not be set aside', async () => {
      const { controller, deps } = setup({
        key: undefined,
        setAsideKey: vi.fn().mockRejectedValue(new Error('EPERM')),
      });
      await expect(controller.resetKey()).rejects.toThrow('EPERM');
      expect(deps.restart).not.toHaveBeenCalled();
    });

    it('is refused when the key works, so that a renderer cannot give up a working key', async () => {
      const { controller, deps } = setup();
      await expect(controller.resetKey()).rejects.toThrow();
      expect(deps.confirmResetKey).not.toHaveBeenCalled();
      expect(deps.setAsideKey).not.toHaveBeenCalled();
      expect(deps.restart).not.toHaveBeenCalled();
    });
  });
});

describe('the local encryption key of the controller', () => {
  describe('isKeyAvailable()', () => {
    it('is true when the database was opened with a key', async () => {
      const { controller } = setup();
      expect(await controller.isKeyAvailable()).toBe(true);
    });

    it('is false in degraded mode, where there is no key', async () => {
      const { controller } = setup({ key: undefined });
      expect(await controller.isKeyAvailable()).toBe(false);
    });

    it('answers with a boolean and not with anything of the key', async () => {
      const { controller } = setup();
      expect(await controller.isKeyAvailable()).toBe(true);
      expect(JSON.stringify(await controller.isKeyAvailable())).toBe('true');
    });
  });

  describe('getKey()', () => {
    it('gives the key as JWK JSON text and as the base64 of that text', async () => {
      const { controller } = setup();
      const { jwk, base64 } = await controller.getKey();

      expect(JSON.parse(jwk)).toEqual({
        'kty': 'oct',
        'k': localKey.export().toString('base64url'),
        'x-insomnia-host': hostname(),
      });
      expect(Buffer.from(base64, 'base64').toString('utf8')).toBe(jwk);
    });

    it('records the name of this machine in the key, in both forms', async () => {
      const { controller } = setup();
      const { jwk, base64 } = await controller.getKey();

      expect(getFieldEncryptionKeyHost(jwk)).toBe(hostname());
      expect(getFieldEncryptionKeyHost(base64)).toBe(hostname());
    });

    it('gives a key that is the one the database uses', async () => {
      const { controller } = setup();
      const { base64 } = await controller.getKey();
      const jwk = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
      expect(createSecretKey(Buffer.from(jwk.k, 'base64url')).equals(localKey)).toBe(true);
    });

    it('rejects in degraded mode instead of giving out something', async () => {
      const { controller } = setup({ key: undefined });
      await expect(controller.getKey()).rejects.toThrow('There is no local encryption key in this session');
    });
  });
});

describe('confirmLocalKeyReset()', () => {
  let confirmLocalKeyReset: typeof ConfirmLocalKeyReset;
  beforeAll(async () => {
    // The setup file already loaded this module with the global electron mock; load it again with the mock of this file
    vi.resetModules();
    ({ confirmLocalKeyReset } = await import('../field-encryption'));
  });

  const answer = (response: number) => vi.fn(async (_window: unknown, _options: unknown) => ({ response }));

  it('is a yes only for the reset button, and Cancel is the default and the Esc key', async () => {
    const showMessageBox = answer(1);
    expect(await confirmLocalKeyReset(undefined, showMessageBox)).toBe(true);
    const options = showMessageBox.mock.calls[0][1] as Electron.MessageBoxOptions;
    expect(options.buttons).toEqual(['Cancel', 'Reset Key and Restart']);
    expect(options.defaultId).toBe(0);
    expect(options.cancelId).toBe(0);
    expect(options.detail).toContain('unreadable for good');
  });

  it('is a no when the user cancels', async () => {
    expect(await confirmLocalKeyReset(undefined, answer(0))).toBe(false);
  });

  it('shows the question on top of the window that asked', async () => {
    const window = { id: 7 };
    fromWebContents.mockReturnValue(window);
    const showMessageBox = answer(0);
    await confirmLocalKeyReset({} as never, showMessageBox);
    expect(showMessageBox.mock.calls[0][0]).toBe(window);
  });
});

describe('the IPC handler', () => {
  const sender = { id: 'main-window-contents' } as never;
  let handlerModule: typeof FieldEncryptionModule;
  let registerAllIpcHandlers: typeof RegisterAllIpcHandlers;

  const fakeController = () => ({
    getStatus: vi.fn(async () => ({ kind: 'ok' }) as const),
    resetFailedFields: vi.fn(async () => 3),
    resetKey: vi.fn(async (_sender?: unknown) => true),
    dismiss: vi.fn(async () => {}),
    isKeyAvailable: vi.fn(async () => true),
    getKey: vi.fn(async () => ({ jwk: '{"kty":"oct","k":"a2V5"}', base64: 'eyJrdHkiOiJvY3QiLCJrIjoiYTJWNSJ9' })),
  });

  /** What the renderer reaches: the `main.invoke` handler that `registerAllIpcHandlers` registers. */
  const rendererInvoke = (...args: unknown[]) => {
    const registered = ipcMainHandle.mock.calls.find(([channel]) => channel === 'main.invoke');
    return Promise.resolve().then(() => registered![1]({ sender }, ...args));
  };

  beforeEach(async () => {
    // The controller is kept in module state, so each test starts from a fresh module. The setup file also loaded it.
    vi.resetModules();
    ipcMainHandle.mockClear();
    handlerModule = await import('../field-encryption');
    ({ registerAllIpcHandlers } = await import('../base-ipc-handler'));
  });

  it('is reached on the fieldEncryption channel and answers from the controller it was given', async () => {
    const controller = fakeController();
    handlerModule.provideFieldEncryptionController(controller as never);
    registerAllIpcHandlers([handlerModule.fieldEncryptionIpcHandler]);

    expect(await rendererInvoke('fieldEncryption', 'getStatus')).toEqual({ kind: 'ok' });
    expect(await rendererInvoke('fieldEncryption', 'resetFailedFields')).toBe(3);
    await rendererInvoke('fieldEncryption', 'dismiss');
    expect(controller.getStatus).toHaveBeenCalledTimes(1);
    expect(controller.resetFailedFields).toHaveBeenCalledTimes(1);
    expect(controller.dismiss).toHaveBeenCalledTimes(1);
  });

  it('answers isKeyAvailable and getKey from the controller, and getKey only when asked', async () => {
    const controller = fakeController();
    handlerModule.provideFieldEncryptionController(controller as never);
    registerAllIpcHandlers([handlerModule.fieldEncryptionIpcHandler]);

    expect(await rendererInvoke('fieldEncryption', 'isKeyAvailable')).toBe(true);
    expect(controller.getKey).not.toHaveBeenCalled();
    expect(await rendererInvoke('fieldEncryption', 'getKey')).toEqual({
      jwk: '{"kty":"oct","k":"a2V5"}',
      base64: 'eyJrdHkiOiJvY3QiLCJrIjoiYTJWNSJ9',
    });
    expect(controller.getKey).toHaveBeenCalledTimes(1);
  });

  it('passes the error of getKey on to the renderer', async () => {
    const controller = fakeController();
    controller.getKey.mockRejectedValue(new Error('There is no local encryption key in this session'));
    handlerModule.provideFieldEncryptionController(controller as never);
    registerAllIpcHandlers([handlerModule.fieldEncryptionIpcHandler]);

    await expect(rendererInvoke('fieldEncryption', 'getKey')).rejects.toThrow('no local encryption key');
  });

  it('passes the window that asked to resetKey, so the confirmation is shown on top of it', async () => {
    const controller = fakeController();
    handlerModule.provideFieldEncryptionController(controller as never);
    registerAllIpcHandlers([handlerModule.fieldEncryptionIpcHandler]);

    expect(await rendererInvoke('fieldEncryption', 'resetKey')).toBe(true);
    expect(controller.resetKey).toHaveBeenCalledWith(sender);
  });

  it('does not pass the arguments of the renderer on: the controller decides from its own state', async () => {
    const controller = fakeController();
    handlerModule.provideFieldEncryptionController(controller as never);
    registerAllIpcHandlers([handlerModule.fieldEncryptionIpcHandler]);

    await rendererInvoke('fieldEncryption', 'resetFailedFields', { degraded: false }, 'anything');
    await rendererInvoke('fieldEncryption', 'dismiss', 'anything');
    await rendererInvoke('fieldEncryption', 'isKeyAvailable', 'anything');
    await rendererInvoke('fieldEncryption', 'getKey', { key: 'another key' });
    expect(controller.resetFailedFields).toHaveBeenCalledWith();
    expect(controller.dismiss).toHaveBeenCalledWith();
    expect(controller.isKeyAvailable).toHaveBeenCalledWith();
    expect(controller.getKey).toHaveBeenCalledWith();
  });

  it('refuses to answer before the database has given it a controller', async () => {
    registerAllIpcHandlers([handlerModule.fieldEncryptionIpcHandler]);
    await expect(rendererInvoke('fieldEncryption', 'getStatus')).rejects.toThrow('not available yet');
    await expect(rendererInvoke('fieldEncryption', 'resetKey')).rejects.toThrow('not available yet');
    await expect(rendererInvoke('fieldEncryption', 'isKeyAvailable')).rejects.toThrow('not available yet');
    await expect(rendererInvoke('fieldEncryption', 'getKey')).rejects.toThrow('not available yet');
  });

  it('can be replaced when the database is opened again', async () => {
    registerAllIpcHandlers([handlerModule.fieldEncryptionIpcHandler]);
    const first = fakeController();
    const second = fakeController();
    handlerModule.provideFieldEncryptionController(first as never);
    handlerModule.provideFieldEncryptionController(second as never);

    await rendererInvoke('fieldEncryption', 'dismiss');
    expect(first.dismiss).not.toHaveBeenCalled();
    expect(second.dismiss).toHaveBeenCalledTimes(1);
  });

  describe('what the renderer can reach', () => {
    // The dispatcher calls any function of a registered handler for the renderer, so the class may hold nothing but API
    it('has exactly the six methods of the API, and nothing that changes what they use', () => {
      expect(Object.getOwnPropertyNames(handlerModule.FieldEncryptionIpcHandler.prototype).sort()).toEqual([
        'constructor',
        'dismiss',
        'getKey',
        'getStatus',
        'isKeyAvailable',
        'resetFailedFields',
        'resetKey',
      ]);
      expect(Object.getOwnPropertyNames(handlerModule.fieldEncryptionIpcHandler)).toEqual(['channel']);
    });

    it.each(['provideFieldEncryptionController', 'getController', 'controller', 'channel', 'register', 'nope'])(
      'cannot call or replace %s',
      async name => {
        const controller = fakeController();
        handlerModule.provideFieldEncryptionController(controller as never);
        registerAllIpcHandlers([handlerModule.fieldEncryptionIpcHandler]);

        await expect(
          rendererInvoke('fieldEncryption', name, { getStatus: async () => ({ kind: 'ok' }) }),
        ).rejects.toThrow(new TypeError(`Method ${name} is not a function`));
        // still the controller of the main process
        expect(await rendererInvoke('fieldEncryption', 'resetFailedFields')).toBe(3);
      },
    );

    it('does not answer on another channel', async () => {
      registerAllIpcHandlers([handlerModule.fieldEncryptionIpcHandler]);
      await expect(rendererInvoke('fieldencryption', 'getStatus')).rejects.toThrow('No IPC handler registered');
    });
  });
});
