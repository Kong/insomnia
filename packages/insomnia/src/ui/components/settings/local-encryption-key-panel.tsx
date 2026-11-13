import React, { useEffect, useState } from 'react';
import { Button } from 'react-aria-components';

import { fieldEncryption } from '~/ui/ipc';

import { showError, showModal } from '../modals';
import { AskModal } from '../modals/ask-modal';

// 'unknown': the main process could not tell, so the buttons stay off rather than offer something that may not work
type KeyState = 'loading' | 'available' | 'unavailable' | 'unknown';

const buttonClassName =
  'btn btn--outlined btn--super-compact width-auto flex items-center justify-center gap-2 disabled:opacity-50';
const noticeClassName =
  'm-0 rounded-sm border border-solid border-(--hl-md) bg-(--color-warning)/50 p-(--padding-xs) text-(--color-font-warning)';
const COPIED_MESSAGE_MS = 2000;

/**
 * Preferences section that gives the user the local encryption key of the database, for tools that read the `.db`
 * files, such as inso. Which key it is, and whether there is one, only the main process knows: this panel asks whether a
 * key is available when it is shown, and fetches the key itself only when a button is pressed.
 */
export const LocalEncryptionKeyPanel = () => {
  const [keyState, setKeyState] = useState<KeyState>('loading');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fieldEncryption
      .isKeyAvailable()
      .then(available => !cancelled && setKeyState(available ? 'available' : 'unavailable'))
      .catch(error => {
        console.error('[field-encryption] Could not tell whether a local encryption key is available', error);
        if (!cancelled) {
          setKeyState('unknown');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), COPIED_MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  // The inso CLI writes encrypted values back to the data it reads. Used on another machine, the key would encrypt that
  // machine's database with a key its Insomnia does not have, so the user is told before the key leaves this panel.
  const confirmThenRun = (run: () => Promise<void>) =>
    showModal(AskModal, {
      title: 'Careful: Keep this key private & use it only on this machine',
      message: (
        <div className="flex flex-col gap-2">
          <p className="m-0">Inso CLI requires this key to access sensitive values.</p>
          <p className="m-0">
            <strong>Never share this key:</strong> Anyone with this key can decrypt locally stored tokens, values, etc.
          </p>
          <p className="m-0">
            <strong>Never use it on another machine:</strong> Using the wrong key can corrupt data.
          </p>
        </div>
      ),
      centered: true,
      yesText: 'I understand, continue',
      noText: 'Cancel',
      onDone: async (confirmed: boolean) => {
        if (confirmed) {
          await run();
        }
      },
    });

  const copyKey = async () => {
    try {
      const { base64 } = await fieldEncryption.getKey();
      window.clipboard.writeText(base64);
      setCopied(true);
    } catch (error) {
      showError({ title: 'Could not copy the local encryption key', error });
    }
  };

  const exportKey = async () => {
    try {
      const { jwk } = await fieldEncryption.getKey();
      const { canceled, filePath } = await window.dialog.showSaveDialog({
        title: 'Export Local Encryption Key',
        buttonLabel: 'Save',
        defaultPath: 'insomnia-encryption-key.json',
      });
      if (canceled || !filePath) {
        return;
      }
      await window.main.writeFile({ path: filePath, content: jwk });
    } catch (error) {
      showError({ title: 'Could not export the local encryption key', error });
    }
  };

  const buttonsDisabled = keyState !== 'available';

  return (
    <div className="form-row pad-top-sm flex-col items-start gap-2" data-testid="local-encryption-key-panel">
      <div>
        <span className="font-semibold">Local Encryption Key</span>
        <p className="m-0 mt-1 text-(--hl)">
          Used for encryption of sensitive values in your local Insomnia database. Inso CLI needs this key to access
          sensitive values.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          data-testid="local-encryption-key-copy"
          className={buttonClassName}
          isDisabled={buttonsDisabled}
          onPress={() => confirmThenRun(copyKey)}
        >
          {copied ? (
            <span>
              Copied <i className="fa fa-check-circle-o" />
            </span>
          ) : (
            'Copy Key'
          )}
        </Button>
        <Button
          data-testid="local-encryption-key-export"
          className={buttonClassName}
          isDisabled={buttonsDisabled}
          onPress={() => confirmThenRun(exportKey)}
        >
          Export Key
        </Button>
      </div>
      {keyState === 'unavailable' && (
        <p data-testid="local-encryption-key-unavailable" className={noticeClassName}>
          The local encryption key could not be loaded in this session, so there is no key to copy or export.
        </p>
      )}
      {keyState === 'unknown' && (
        <p data-testid="local-encryption-key-unknown" className={noticeClassName}>
          Could not check whether a local encryption key is available.
        </p>
      )}
    </div>
  );
};
