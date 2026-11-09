import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  type confirmLocalKeyReset as ConfirmLocalKeyReset,
  createFieldEncryptionController,
  type FieldEncryptionControllerDeps,
} from '../field-encryption';

const { fromWebContents } = vi.hoisted(() => ({ fromWebContents: vi.fn() }));
vi.mock('electron', () => ({
  app: { relaunch: vi.fn(), exit: vi.fn() },
  BrowserWindow: { fromWebContents },
  dialog: {},
}));
vi.mock('../electron', () => ({ ipcMainHandle: vi.fn() }));

const failure = (overrides: Partial<{ type: string; _id: string; path: string }> = {}) => ({
  type: 'Request',
  _id: 'req_1',
  path: 'authentication.password',
  ...overrides,
});

const setup = (overrides: Partial<FieldEncryptionControllerDeps> = {}) => {
  const deps: FieldEncryptionControllerDeps = {
    degraded: false,
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
      const { controller, deps } = setup({ degraded: true });
      expect(await controller.getStatus()).toEqual({ kind: 'degraded', canResetKey: true });
      expect(deps.refreshFailures).not.toHaveBeenCalled();
    });

    it('says that the key cannot be reset when there is no key file, which is the case when it could not be created', async () => {
      const { controller } = setup({ degraded: true, keyFileExists: vi.fn(() => false) });
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
      const { controller, deps } = setup({ degraded: true });
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
      const { controller } = setup({ degraded: true });
      await controller.dismiss();
      expect(await controller.getStatus()).toEqual({ kind: 'ok' });
    });
  });

  describe('resetKey()', () => {
    it('asks the user, then sets the key aside, then restarts, in that order', async () => {
      const order: string[] = [];
      const { controller } = setup({
        degraded: true,
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
      const { controller, deps } = setup({ degraded: true, confirmResetKey: vi.fn(async () => false) });
      expect(await controller.resetKey()).toBe(false);
      expect(deps.setAsideKey).not.toHaveBeenCalled();
      expect(deps.restart).not.toHaveBeenCalled();
    });

    it('passes the window that asked, so the question is shown on top of it', async () => {
      const { controller, deps } = setup({ degraded: true });
      const sender = {} as never;
      await controller.resetKey(sender);
      expect(deps.confirmResetKey).toHaveBeenCalledWith(sender);
    });

    it('is refused when there is no key file, without asking the user', async () => {
      const { controller, deps } = setup({ degraded: true, keyFileExists: vi.fn(() => false) });
      await expect(controller.resetKey()).rejects.toThrow('no encryption key file');
      expect(deps.confirmResetKey).not.toHaveBeenCalled();
      expect(deps.setAsideKey).not.toHaveBeenCalled();
    });

    it('does not restart when the key could not be set aside', async () => {
      const { controller, deps } = setup({
        degraded: true,
        setAsideKey: vi.fn().mockRejectedValue(new Error('EPERM')),
      });
      await expect(controller.resetKey()).rejects.toThrow('EPERM');
      expect(deps.restart).not.toHaveBeenCalled();
    });

    it('is refused when the key works, so that a renderer cannot give up a working key', async () => {
      const { controller, deps } = setup({ degraded: false });
      await expect(controller.resetKey()).rejects.toThrow();
      expect(deps.confirmResetKey).not.toHaveBeenCalled();
      expect(deps.setAsideKey).not.toHaveBeenCalled();
      expect(deps.restart).not.toHaveBeenCalled();
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
