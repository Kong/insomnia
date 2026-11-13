import { afterEach, describe, expect, it, vi } from 'vitest';

import { fieldEncryption, sync } from '../ipc';

describe('IPC triggers of the renderer', () => {
  const mainInvoke = vi.fn(async (..._args: unknown[]) => 'answer');

  afterEach(() => {
    vi.unstubAllGlobals();
    mainInvoke.mockClear();
  });

  const stubWindow = () => vi.stubGlobal('window', { _mainInvoke: mainInvoke });

  it('calls the main process on the fieldEncryption domain, without a sender argument', async () => {
    stubWindow();

    expect(await fieldEncryption.getStatus()).toBe('answer');
    await fieldEncryption.resetFailedFields();
    await fieldEncryption.resetKey();
    await fieldEncryption.dismiss();

    expect(mainInvoke.mock.calls).toEqual([
      ['fieldEncryption', 'getStatus'],
      ['fieldEncryption', 'resetFailedFields'],
      ['fieldEncryption', 'resetKey'],
      ['fieldEncryption', 'dismiss'],
    ]);
  });

  it('keeps the domains apart: the sync trigger still goes to sync', async () => {
    stubWindow();

    await (sync as unknown as { fork: (...args: unknown[]) => Promise<unknown> }).fork('wrk_1', 'branch');

    expect(mainInvoke).toHaveBeenCalledWith('sync', 'fork', 'wrk_1', 'branch');
  });

  it('only reaches the main process when a method is called, not when the trigger is imported', () => {
    stubWindow();
    expect(mainInvoke).not.toHaveBeenCalled();
  });
});
