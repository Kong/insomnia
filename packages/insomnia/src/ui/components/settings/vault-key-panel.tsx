import React, { useCallback, useEffect, useState } from 'react';
import { Button } from 'react-aria-components';
import { useFetcher } from 'react-router-dom';
import { useInterval } from 'react-use';

import { getProductName } from '../../../common/constants';
import { decryptVaultKeyFromSession, deleteVaultKeyFromStorage, saveVaultKeyIfNecessary } from '../../../utils/vault';
import { useRootLoaderData } from '../../routes/root';
import { CopyButton } from '../base/copy-button';
import { HelpTooltip } from '../help-tooltip';
import { Icon } from '../icon';
import { showError, showModal } from '../modals';
import { AskModal } from '../modals/ask-modal';
import { InputVaultKeyModal } from '../modals/input-vault-key-modal';
import { BooleanSetting } from './boolean-setting';

export const VaultKeyDisplayInput = ({ vaultKey }: { vaultKey: string }) => {
  const [showCopyConfirmation, setShowCopyConfirmation] = useState(false);

  useInterval(() => {
    setShowCopyConfirmation(false);
  }, 2000);

  const donwloadVaultKey = async () => {
    const { canceled, filePath: outputPath } = await window.dialog.showSaveDialog({
      title: 'Download Vault Key',
      buttonLabel: 'Save',
      defaultPath: `${getProductName()}-vault-key-${Date.now()}.txt`,
    });

    if (canceled || !outputPath) {
      return;
    }

    await window.main.writeFile({
      path: outputPath,
      content: vaultKey,
    });
  };

  return (
    <div className="flex items-center gap-3 bg-[--hl-xs] px-2 py-1 border border-solid border-[--hl-sm] w-full">
      <div
        className="w-[calc(100%-50px)] truncate"
        data-testid="VaultKeyDisplayPanel"
        onDoubleClick={(event: React.MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
          if (vaultKey) {
            window.clipboard.writeText(vaultKey);
          };
          setShowCopyConfirmation(true);
        }}
      >
        {vaultKey}
      </div>
      <CopyButton
        size="small"
        content={vaultKey}
        title="Copy Vault Key"
        showConfirmation={showCopyConfirmation}
        style={{ borderWidth: 0 }}
      >
        <i className="fa fa-copy" />
      </CopyButton>
      <Button onPress={donwloadVaultKey}>
        <i className="fa-solid fa-download" />
      </Button>
    </div>

  );
};

export const VaultKeyPanel = () => {
  const { userSession, settings } = useRootLoaderData();
  const { saveVaultKeyLocally } = settings;
  const [isGenerating, setGenerating] = useState(false);
  const [vaultKeyValue, setVaultKeyValue] = useState('');
  const [showInputVaultKeyModal, setShowModal] = useState(false);
  const { accountId, vaultKey, vaultSalt } = userSession;
  const vaultKeyFetcher = useFetcher();
  const vaultSaltFetcher = useFetcher();
  const vaultSaltExists = typeof vaultSalt === 'string' && vaultSalt.length > 0;
  const vaultKeyExists = typeof vaultKey === 'string' && vaultKey.length > 0;

  const showVaultKey = useCallback(async () => {
    if (vaultKey) {
      // decrypt vault key saved in user session
      const decryptedVaultKey = await decryptVaultKeyFromSession(vaultKey, false);
      setVaultKeyValue(decryptedVaultKey);
    }
  }, [vaultKey]);

  useEffect(() => {
    if (vaultKeyExists) {
      showVaultKey();
    }
  }, [showVaultKey, vaultKeyExists]);

  useEffect(() => {
    if (vaultKeyFetcher.data && !vaultKeyFetcher.data.error && vaultKeyFetcher.state === 'idle') {
      setGenerating(false);
      setVaultKeyValue(vaultKeyFetcher.data);
    };
  }, [vaultKeyFetcher.data, vaultKeyFetcher.state]);

  useEffect(() => {
    if (vaultKeyFetcher.data && vaultKeyFetcher.data.error && vaultKeyFetcher.state === 'idle') {
      setGenerating(false);
      // user has created vault key in another device;
      if (vaultKeyFetcher.data.error.toLowerCase().includes('conflict')) {
        // get vault salt from server
        vaultSaltFetcher.submit('', {
          action: '/auth/updateVaultSalt',
          method: 'POST',
        });
        showModal(AskModal, {
          title: 'Vault Key Already Exists',
          message: 'You have generated the vault key in other device. Please input your vault key',
          yesText: 'OK',
          noText: 'Cancel',
        });
      } else {
        showError({
          title: 'Can not generate vault key',
          message: vaultKeyFetcher.data.error,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- vaultSaltFetcher should only be triggered once
  }, [vaultKeyFetcher.data, vaultKeyFetcher.state]);

  const generateVaultKey = async () => {
    setGenerating(true);
    vaultKeyFetcher.submit('', {
      action: '/auth/createVaultKey',
      method: 'POST',
    });
  };

  const handleModalClose = (newVaultKey?: string) => {
    if (newVaultKey) {
      setVaultKeyValue(newVaultKey);
    };
    setShowModal(false);
  };

  useEffect(() => {
    // save or delete vault key to keychain
    if (saveVaultKeyLocally) {
      if (vaultKeyValue.length > 0) {
        saveVaultKeyIfNecessary(accountId, vaultKeyValue);
      };
    } else {
      deleteVaultKeyFromStorage(accountId);
    };
  }, [saveVaultKeyLocally, accountId, vaultKeyValue]);

  return (
    <div>
      {/* Show Gen Vault button when vault salt does not exist */}
      {!vaultSaltExists &&
        <div className="form-row pad-top-sm justify-start">
          <Button
            className={`flex items-center btn btn--outlined btn--super-compact ${isGenerating ? 'w-56' : 'w-48'}`}
            onPress={generateVaultKey}
            isDisabled={isGenerating}
          >
            {isGenerating && <Icon icon="spinner" className="text-[--color-font] animate-spin m-auto inline-block mr-2" />}
            Generate Vault Key
            <HelpTooltip className="space-left">
              Generate an encryption key to save secrets in private environment. This ensures all secrets are securely stored and encrypted locally.
            </HelpTooltip>
          </Button>
        </div>
      }
      {vaultSaltExists && vaultKeyExists && vaultKeyValue !== '' &&
        <>
          <div className="form-row pad-top-sm flex-col">
            <div className="mb-[var(--padding-xs)]">
              <span className="font-semibold">Vault Key</span>
              <HelpTooltip className="space-left">The vault key will be needed when you login again.</HelpTooltip>
            </div>
            <VaultKeyDisplayInput vaultKey={vaultKeyValue} />
          </div>
          <div className="form-row pad-top-sm">
            <BooleanSetting
              label="Save encrypted vault key locally"
              setting="saveVaultKeyLocally"
            />
          </div>
          <div className="form-row pad-top-sm">
            <BooleanSetting
              label="Enable vault in scripts"
              help="Allow pre-request and after-response script to access vault secrets."
              setting='enableVaultInScripts'
            />
          </div>
        </>
      }
      {/* User has not input vault key after re-login */}
      {vaultSaltExists && !vaultKeyExists &&
        <div className="form-row pad-top-sm justify-start">
          <Button
            className="flex items-center w-48 btn btn--outlined btn--super-compact"
            onPress={() => setShowModal(true)}
          >
            Enter Vault Key
            <HelpTooltip className="space-left">
              Enter your vault key to unlock all local secrets.
            </HelpTooltip>
          </Button>
        </div>
      }
      {showInputVaultKeyModal &&
        <InputVaultKeyModal onClose={handleModalClose} />
      }
    </div>
  );
};
