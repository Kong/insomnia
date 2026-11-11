/**
 * @vitest-environment jsdom
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Required for React's `act` to run without warning outside of a testing-library-managed environment.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const { isKeyAvailable, getKey, showError } = vi.hoisted(() => ({
  isKeyAvailable: vi.fn(),
  getKey: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('~/ui/ipc', () => ({ fieldEncryption: { isKeyAvailable, getKey } }));
vi.mock('../modals', () => ({ showError }));

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

  describe('when a key is available', () => {
    it('shows the explanation, both buttons enabled, and the security notice', async () => {
      await mount();

      const text = byTestId('local-encryption-key-panel')!.textContent;
      expect(text).toContain('Local Encryption Key');
      expect(text).toContain('This key is used to encrypt sensitive fields in your local database.');
      expect(text).toContain('Keep this key secure. Anyone with this key can decrypt');
      expect(byTestId('local-encryption-key-copy')!.disabled).toBe(false);
      expect(byTestId('local-encryption-key-export')!.disabled).toBe(false);
      expect(byTestId('local-encryption-key-unavailable')).toBeNull();
    });

    it('does not ask for the key itself until a button is pressed', async () => {
      await mount();
      expect(isKeyAvailable).toHaveBeenCalledTimes(1);
      expect(getKey).not.toHaveBeenCalled();
    });

    it('copies the base64 form to the clipboard and confirms it', async () => {
      await mount();
      await press('local-encryption-key-copy');

      expect(getKey).toHaveBeenCalledTimes(1);
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(writeText).toHaveBeenCalledWith(key.base64);
      expect(byTestId('local-encryption-key-copy')!.textContent).toContain('Copied');
    });

    it('asks where to save, with the default file name, and writes the JWK JSON there', async () => {
      await mount();
      await press('local-encryption-key-export');

      expect(showSaveDialog).toHaveBeenCalledWith(
        expect.objectContaining({ defaultPath: 'insomnia-encryption-key.json' }),
      );
      expect(writeFile).toHaveBeenCalledWith({ path: 'C:/keys/insomnia-encryption-key.json', content: key.jwk });
      expect(writeText).not.toHaveBeenCalled();
    });

    it('writes nothing when the save dialog is cancelled', async () => {
      showSaveDialog.mockResolvedValue({ canceled: true, filePath: undefined });
      await mount();
      await press('local-encryption-key-export');

      expect(writeFile).not.toHaveBeenCalled();
      expect(showError).not.toHaveBeenCalled();
    });

    it('tells the user when the key cannot be fetched, and copies nothing', async () => {
      const error = new Error('There is no local encryption key in this session');
      getKey.mockRejectedValue(error);
      await mount();
      await press('local-encryption-key-copy');
      await press('local-encryption-key-export');

      expect(writeText).not.toHaveBeenCalled();
      expect(showSaveDialog).not.toHaveBeenCalled();
      expect(showError).toHaveBeenCalledWith({ title: 'Could not copy the local encryption key', error });
      expect(showError).toHaveBeenCalledWith({ title: 'Could not export the local encryption key', error });
    });

    it('tells the user when the file cannot be written', async () => {
      const error = new Error('EACCES');
      writeFile.mockRejectedValue(error);
      await mount();
      await press('local-encryption-key-export');

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
