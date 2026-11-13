/**
 * @vitest-environment jsdom
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Required for React's `act` to run without warning outside of a testing-library-managed environment.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const { getStatus, resetFailedFields, resetKey, dismiss, showError, revalidate } = vi.hoisted(() => ({
  getStatus: vi.fn(),
  resetFailedFields: vi.fn(),
  resetKey: vi.fn(),
  dismiss: vi.fn(),
  showError: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock('~/ui/ipc', () => ({ fieldEncryption: { getStatus, resetFailedFields, resetKey, dismiss } }));
vi.mock('~/ui/components/modals', () => ({ showError }));
vi.mock('react-router', () => ({ useRevalidator: () => ({ revalidate }) }));
vi.mock('../icon', () => ({ Icon: () => null }));

import { FieldEncryptionIssueModal } from './field-encryption-issue-modal';

describe('FieldEncryptionIssueModal', () => {
  let container: HTMLElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    dismiss.mockImplementation(async () => {});
    resetFailedFields.mockResolvedValue(2);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  const mount = async () => {
    await act(async () => {
      root.render(<FieldEncryptionIssueModal />);
    });
  };
  const byTestId = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const press = async (id: string) => {
    await act(async () => {
      byTestId(id)!.click();
    });
  };

  const failedStatus = {
    kind: 'decryptionFailed',
    failures: [
      { type: 'Request', _id: 'req_1', path: 'authentication.password', label: 'Login API' },
      { type: 'Request', _id: 'req_1', path: 'authentication.token', label: 'Login API' },
      { type: 'CookieJar', _id: 'jar_1', path: 'cookies[1].value', label: 'Default Jar' },
    ],
  };

  describe('when the status cannot be read', () => {
    it('tells the user instead of leaving them to believe that the encrypted fields work', async () => {
      const error = new Error('The encryption status of the local database is not available yet');
      getStatus.mockRejectedValue(error);

      await mount();

      expect(showError).toHaveBeenCalledTimes(1);
      expect(showError).toHaveBeenCalledWith({
        title: 'Could not read the encryption status of the local database',
        error,
      });
      expect(byTestId('field-encryption-issue-modal')).toBeNull();
    });

    it('turns a value that is not an Error into one', async () => {
      getStatus.mockRejectedValue('boom');
      await mount();
      expect(showError.mock.calls[0][0].error).toEqual(new Error('boom'));
    });
  });

  it('shows nothing, and no error, when there is nothing to tell', async () => {
    getStatus.mockResolvedValue({ kind: 'ok' });
    await mount();
    expect(byTestId('field-encryption-issue-modal')).toBeNull();
    expect(showError).not.toHaveBeenCalled();
  });

  describe('decryption failures', () => {
    beforeEach(() => getStatus.mockResolvedValue(failedStatus));

    it('lists the documents by name with their fields, a document once however many fields failed', async () => {
      await mount();
      const items = [...document.body.querySelectorAll('[data-testid="field-encryption-failures"] li')];
      expect(items.map(item => item.textContent)).toEqual([
        'Login API (Request)authentication.passwordauthentication.token',
        'Default Jar (CookieJar)cookies[1].value',
      ]);
    });

    it('"Reset affected fields" resets, loads the documents again and closes the dialog', async () => {
      await mount();
      await press('field-encryption-reset-fields');

      expect(resetFailedFields).toHaveBeenCalledTimes(1);
      expect(revalidate).toHaveBeenCalledTimes(1);
      expect(byTestId('field-encryption-issue-modal')).toBeNull();
    });

    it('"Continue without decryption" changes nothing, so it does not load the documents again', async () => {
      await mount();
      await press('field-encryption-continue');

      expect(dismiss).toHaveBeenCalledTimes(1);
      expect(resetFailedFields).not.toHaveBeenCalled();
      expect(revalidate).not.toHaveBeenCalled();
      expect(byTestId('field-encryption-issue-modal')).toBeNull();
    });

    it('shows the error and stays open when the reset fails, so the user can try again', async () => {
      resetFailedFields.mockRejectedValue(new Error('disk full'));
      await mount();
      await press('field-encryption-reset-fields');

      expect(document.body.querySelector('[role="alert"]')?.textContent).toBe('disk full');
      expect(revalidate).not.toHaveBeenCalled();
      expect((byTestId('field-encryption-reset-fields') as HTMLButtonElement).disabled).toBe(false);
    });
  });

  describe('degraded mode', () => {
    it('offers to reset the key when there is a key file', async () => {
      getStatus.mockResolvedValue({ kind: 'degraded', canResetKey: true });
      await mount();
      expect(byTestId('field-encryption-reset-key')).not.toBeNull();
      expect(byTestId('field-encryption-continue')).not.toBeNull();
    });

    it('has only "Continue" when there is no key file to reset', async () => {
      getStatus.mockResolvedValue({ kind: 'degraded', canResetKey: false });
      await mount();
      expect(byTestId('field-encryption-reset-key')).toBeNull();
      expect(byTestId('field-encryption-continue')).not.toBeNull();
    });

    it('stays open, and the button works again, when the user declines the confirmation of the main process', async () => {
      getStatus.mockResolvedValue({ kind: 'degraded', canResetKey: true });
      resetKey.mockResolvedValue(false);
      await mount();
      await press('field-encryption-reset-key');

      expect(resetKey).toHaveBeenCalledTimes(1);
      expect(byTestId('field-encryption-issue-modal')).not.toBeNull();
      expect((byTestId('field-encryption-reset-key') as HTMLButtonElement).disabled).toBe(false);
    });

    it('waits for the restart when the user confirmed, instead of letting the buttons be pressed again', async () => {
      getStatus.mockResolvedValue({ kind: 'degraded', canResetKey: true });
      resetKey.mockResolvedValue(true);
      await mount();
      await press('field-encryption-reset-key');

      expect((byTestId('field-encryption-reset-key') as HTMLButtonElement).disabled).toBe(true);
      expect((byTestId('field-encryption-continue') as HTMLButtonElement).disabled).toBe(true);
    });

    it('shows the error when the key cannot be reset', async () => {
      getStatus.mockResolvedValue({ kind: 'degraded', canResetKey: true });
      resetKey.mockRejectedValue(new Error('There is no encryption key file to reset'));
      await mount();
      await press('field-encryption-reset-key');

      expect(document.body.querySelector('[role="alert"]')?.textContent).toBe(
        'There is no encryption key file to reset',
      );
    });

    it('"Continue" closes the dialog without touching the key', async () => {
      getStatus.mockResolvedValue({ kind: 'degraded', canResetKey: true });
      await mount();
      await press('field-encryption-continue');

      expect(dismiss).toHaveBeenCalledTimes(1);
      expect(resetKey).not.toHaveBeenCalled();
      expect(byTestId('field-encryption-issue-modal')).toBeNull();
    });
  });
});
