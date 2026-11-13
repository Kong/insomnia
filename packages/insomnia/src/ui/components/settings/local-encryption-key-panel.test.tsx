/**
 * @vitest-environment jsdom
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Required for React's `act` to run without warning outside of a testing-library-managed environment.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const { isKeyAvailable, getKey, showError, showModal } = vi.hoisted(() => ({
  isKeyAvailable: vi.fn(),
  getKey: vi.fn(),
  showError: vi.fn(),
  showModal: vi.fn(),
}));

vi.mock('~/ui/ipc', () => ({ fieldEncryption: { isKeyAvailable, getKey } }));
vi.mock('../modals', () => ({ showError, showModal }));
vi.mock('../modals/ask-modal', () => ({ AskModal: 'AskModal' }));

import { LocalEncryptionKeyPanel } from './local-encryption-key-panel';

const key = { jwk: '{"kty":"oct","k":"a2V5"}', base64: 'eyJrdHkiOiJvY3QiLCJrIjoiYTJWNSJ9' };

describe('LocalEncryptionKeyPanel', () => {
  let container: HTMLElement;
  let root: Root;
  const writeText = vi.fn();
  const showSaveDialog = vi.fn();
  const writeFile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    isKeyAvailable.mockResolvedValue(true);
    getKey.mockResolvedValue(key);
    showSaveDialog.mockResolvedValue({ canceled: false, filePath: 'C:/keys/insomnia-encryption-key.json' });
    writeFile.mockResolvedValue('C:/keys/insomnia-encryption-key.json');
    (window as any).clipboard = { writeText };
    (window as any).dialog = { showSaveDialog };
    (window as any).main = { writeFile };
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
      root.render(<LocalEncryptionKeyPanel />);
    });
  };
  const byTestId = (id: string) => document.body.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`);
  const press = async (id: string) => {
    await act(async () => {
      byTestId(id)!.click();
    });
  };
  const lastConfirmation = () =>
    showModal.mock.calls.at(-1)![1] as {
      title: string;
      message: React.ReactNode;
      yesText: string;
      noText: string;
      centered?: boolean;
      onDone: (confirmed: boolean) => Promise<void>;
    };
  const answerConfirmation = async (confirmed: boolean) => {
    await act(async () => {
      await lastConfirmation().onDone(confirmed);
    });
  };
  /** Presses a button and agrees to the confirmation that it asks for. */
  const pressAndConfirm = async (id: string) => {
    await press(id);
    await answerConfirmation(true);
  };

  describe('when a key is available', () => {
    it('shows the explanation and both buttons enabled, and leaves the security notice to the confirmation', async () => {
      await mount();

      const text = byTestId('local-encryption-key-panel')!.textContent;
      expect(text).toContain('Local Encryption Key');
      expect(text).toContain(
        'Used for encryption of sensitive values in your local Insomnia database. Inso CLI needs this key to access sensitive values.',
      );
      expect(text).not.toContain('Never share this key');
      expect(byTestId('local-encryption-key-copy')!.disabled).toBe(false);
      expect(byTestId('local-encryption-key-export')!.disabled).toBe(false);
      expect(byTestId('local-encryption-key-unavailable')).toBeNull();
    });

    it('does not ask for the key itself until a button is pressed', async () => {
      await mount();
      expect(isKeyAvailable).toHaveBeenCalledTimes(1);
      expect(getKey).not.toHaveBeenCalled();
    });

    describe.each([
      ['Copy Key', 'local-encryption-key-copy'],
      ['Export Key', 'local-encryption-key-export'],
    ])('the confirmation before %s', (_, id) => {
      it('asks first, and does not touch the key, the clipboard or the file until the user agrees', async () => {
        await mount();
        await press(id);

        expect(showModal).toHaveBeenCalledTimes(1);
        expect(getKey).not.toHaveBeenCalled();
        expect(writeText).not.toHaveBeenCalled();
        expect(showSaveDialog).not.toHaveBeenCalled();
        expect(writeFile).not.toHaveBeenCalled();
      });

      it('tells the user that the key is private and for this machine only', async () => {
        await mount();
        await press(id);

        const { title, message, yesText, noText, centered } = lastConfirmation();
        const text = renderToStaticMarkup(<>{message}</>);
        expect(title).toBe('Careful: Keep this key private & use it only on this machine');
        expect(text).toContain('Inso CLI requires this key to access sensitive values.');
        expect(text).toContain(
          '<strong>Never share this key:</strong> Anyone with this key can decrypt locally stored',
        );
        expect(text).toContain('tokens, values, etc.');
        expect(text).toContain(
          '<strong>Never use it on another machine:</strong> Using the wrong key can corrupt data.',
        );
        expect(centered).toBe(true);
        expect(yesText).toBe('I understand, continue');
        expect(noText).toBe('Cancel');
      });

      it('does nothing when the user cancels', async () => {
        await mount();
        await press(id);
        await answerConfirmation(false);

        expect(getKey).not.toHaveBeenCalled();
        expect(writeText).not.toHaveBeenCalled();
        expect(showSaveDialog).not.toHaveBeenCalled();
        expect(writeFile).not.toHaveBeenCalled();
        expect(showError).not.toHaveBeenCalled();
      });
    });

    it('asks again every time a button is pressed', async () => {
      await mount();
      await pressAndConfirm('local-encryption-key-copy');
      await pressAndConfirm('local-encryption-key-copy');
      await pressAndConfirm('local-encryption-key-export');

      expect(showModal).toHaveBeenCalledTimes(3);
    });

    it('copies the base64 form to the clipboard and confirms it', async () => {
      await mount();
      await pressAndConfirm('local-encryption-key-copy');

      expect(getKey).toHaveBeenCalledTimes(1);
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(writeText).toHaveBeenCalledWith(key.base64);
      expect(byTestId('local-encryption-key-copy')!.textContent).toContain('Copied');
    });

    it('asks where to save, with the default file name, and writes the JWK JSON there', async () => {
      await mount();
      await pressAndConfirm('local-encryption-key-export');

      expect(showSaveDialog).toHaveBeenCalledWith(
        expect.objectContaining({ defaultPath: 'insomnia-encryption-key.json' }),
      );
      expect(writeFile).toHaveBeenCalledWith({ path: 'C:/keys/insomnia-encryption-key.json', content: key.jwk });
      expect(writeText).not.toHaveBeenCalled();
    });

    it('writes nothing when the save dialog is cancelled', async () => {
      showSaveDialog.mockResolvedValue({ canceled: true, filePath: undefined });
      await mount();
      await pressAndConfirm('local-encryption-key-export');

      expect(writeFile).not.toHaveBeenCalled();
      expect(showError).not.toHaveBeenCalled();
    });

    it('tells the user when the key cannot be fetched, and copies nothing', async () => {
      const error = new Error('There is no local encryption key in this session');
      getKey.mockRejectedValue(error);
      await mount();
      await pressAndConfirm('local-encryption-key-copy');
      await pressAndConfirm('local-encryption-key-export');

      expect(writeText).not.toHaveBeenCalled();
      expect(showSaveDialog).not.toHaveBeenCalled();
      expect(showError).toHaveBeenCalledWith({ title: 'Could not copy the local encryption key', error });
      expect(showError).toHaveBeenCalledWith({ title: 'Could not export the local encryption key', error });
    });

    it('tells the user when the file cannot be written', async () => {
      const error = new Error('EACCES');
      writeFile.mockRejectedValue(error);
      await mount();
      await pressAndConfirm('local-encryption-key-export');

      expect(showError).toHaveBeenCalledWith({ title: 'Could not export the local encryption key', error });
    });
  });

  describe('without a key (degraded mode)', () => {
    beforeEach(() => {
      isKeyAvailable.mockResolvedValue(false);
    });

    it('still shows the section, with both buttons disabled and the reason', async () => {
      await mount();

      expect(byTestId('local-encryption-key-panel')!.textContent).toContain('Local Encryption Key');
      expect(byTestId('local-encryption-key-copy')!.disabled).toBe(true);
      expect(byTestId('local-encryption-key-export')!.disabled).toBe(true);
      expect(byTestId('local-encryption-key-unavailable')!.textContent).toContain('no key to copy or export');
    });

    it('does nothing when the disabled buttons are pressed', async () => {
      await mount();
      await press('local-encryption-key-copy');
      await press('local-encryption-key-export');

      expect(showModal).not.toHaveBeenCalled();
      expect(getKey).not.toHaveBeenCalled();
      expect(writeText).not.toHaveBeenCalled();
      expect(showSaveDialog).not.toHaveBeenCalled();
    });
  });

  it('keeps the buttons disabled while it is not known whether there is a key', async () => {
    let resolve!: (available: boolean) => void;
    isKeyAvailable.mockReturnValue(new Promise<boolean>(r => (resolve = r)));
    await mount();

    expect(byTestId('local-encryption-key-copy')!.disabled).toBe(true);
    expect(byTestId('local-encryption-key-export')!.disabled).toBe(true);
    expect(byTestId('local-encryption-key-unavailable')).toBeNull();

    await act(async () => resolve(true));
    expect(byTestId('local-encryption-key-copy')!.disabled).toBe(false);
  });

  it('keeps the buttons disabled and says so when the main process cannot tell', async () => {
    isKeyAvailable.mockRejectedValue(new Error('The encryption status of the local database is not available yet'));
    await mount();

    expect(byTestId('local-encryption-key-copy')!.disabled).toBe(true);
    expect(byTestId('local-encryption-key-export')!.disabled).toBe(true);
    expect(byTestId('local-encryption-key-unknown')).not.toBeNull();
    expect(byTestId('local-encryption-key-unavailable')).toBeNull();
  });
});
