import React, { useCallback, useEffect, useState } from 'react';
import { Button } from 'react-aria-components';
import * as reactUse from 'react-use';

import { getProductName } from '~/common/constants';
import { useRootLoaderData } from '~/root';
import { useCreateVaultKeyFetcher } from '~/routes/auth.create-vault-key';
import { useUpdateVaultSaltFetcher } from '~/routes/auth.update-vault-salt';
import { CopyButton } from '~/ui/components/base/copy-button';
import { HelpTooltip } from '~/ui/components/help-tooltip';
import { Icon } from '~/ui/components/icon';
import { showError, showModal } from '~/ui/components/modals';
import { AskModal } from '~/ui/components/modals/ask-modal';
import { InputVaultKeyModal } from '~/ui/components/modals/input-vault-key-modal';
import { decryptVaultKeyFromSession, deleteVaultKeyFromStorage, saveVaultKeyIfNecessary } from '~/utils/vault';

import { BooleanSetting } from './boolean-setting';

export const VaultKeyDisplayInput = ({ vaultKey }: { vaultKey: string }) => {
  const [showCopyConfirmation, setShowCopyConfirmation] = useState(false);

  reactUse.useInterval(() => {
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
    <div className="flex w-full items-center gap-3 border border-solid border-(--hl-sm) bg-(--hl-xs) px-2 py-1">
      <div
        className="w-[calc(100%-50px)] truncate"
        data-testid="VaultKeyDisplayPanel"
        onDoubleClick={(event: React.MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
          if (vaultKey) {
            window.clipboard.writeText(vaultKey);
          }
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
  const { userSession, settings } = useRootLoaderData()!;
  const { saveVaultKeyLocally } = settings;
  const [isGenerating, setGenerating] = useState(false);
  const [vaultKeyValue, setVaultKeyValue] = useState('');
  const [showInputVaultKeyModal, setShowModal] = useState(false);
  const { accountId, vaultKey, vaultSalt } = userSession;
  const createVaultKeyFetcher = useCreateVaultKeyFetcher();
  const updateVaultSaltFetcher = useUpdateVaultSaltFetcher();
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
    if (createVaultKeyFetcher.data && !createVaultKeyFetcher.data.error && createVaultKeyFetcher.state === 'idle') {
      setGenerating(false);
      setVaultKeyValue(createVaultKeyFetcher.data.key || '');
    }
  }, [createVaultKeyFetcher.data, createVaultKeyFetcher.state]);

  useEffect(() => {
    if (createVaultKeyFetcher.data && createVaultKeyFetcher.data.error && createVaultKeyFetcher.state === 'idle') {
      setGenerating(false);
      // user has created vault key in another device;
      if (createVaultKeyFetcher.data.error.toLowerCase().includes('conflict')) {
        // get vault salt from server
        updateVaultSaltFetcher.submit();
        showModal(AskModal, {
          title: 'Vault Key Already Exists',
          message: 'You have generated the vault key in other device. Please input your vault key',
          yesText: 'OK',
          noText: 'Cancel',
        });
      } else {
        showError({
          title: 'Can not generate vault key',
          message: createVaultKeyFetcher.data.error,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- vaultSaltFetcher should only be triggered once
  }, [createVaultKeyFetcher.data, createVaultKeyFetcher.state]);

  const generateVaultKey = async () => {
    setGenerating(true);
    createVaultKeyFetcher.submit();
  };

  const handleModalClose = (newVaultKey?: string) => {
    if (newVaultKey) {
      setVaultKeyValue(newVaultKey);
    }
    setShowModal(false);
  };

  useEffect(() => {
    // save or delete vault key to keychain
    if (saveVaultKeyLocally) {
      if (vaultKeyValue.length > 0) {
        saveVaultKeyIfNecessary(accountId, vaultKeyValue);
      }
    } else {
      deleteVaultKeyFromStorage(accountId);
    }
  }, [saveVaultKeyLocally, accountId, vaultKeyValue]);

  return (
    <div>
      {/* Show Gen Vault button when vault salt does not exist */}
      {!vaultSaltExists && (
        <div className="form-row pad-top-sm justify-start">
          <Button
            className={`btn btn--outlined btn--super-compact flex items-center ${isGenerating ? 'w-56' : 'w-48'}`}
            onPress={generateVaultKey}
            isDisabled={isGenerating}
            aria-label="Generate Vault Key"
          >
            {isGenerating && (
              <Icon icon="spinner" className="m-auto mr-2 inline-block animate-spin text-(--color-font)" />
            )}
            Generate Vault Key
            <HelpTooltip className="space-left">
              Generate an encryption key to save secrets in private environment. This ensures all secrets are securely
              stored and encrypted locally.
            </HelpTooltip>
          </Button>
        </div>
      )}
      {vaultSaltExists && vaultKeyExists && vaultKeyValue !== '' && (
        <>
          <div className="form-row pad-top-sm flex-col">
            <div className="mb-(--padding-xs)">
              <span className="font-semibold">Vault Key</span>
              <HelpTooltip className="space-left">The vault key will be needed when you login again.</HelpTooltip>
            </div>
            <VaultKeyDisplayInput vaultKey={vaultKeyValue} />
          </div>
          <div className="form-row pad-top-sm">
            <BooleanSetting
              label="Save encrypted vault key locally"
              setting="saveVaultKeyLocally"
              confirmMessage={isChecked =>
                isChecked
                  ? 'Are you sure to save the vault key locally? The vault key will be encrypted and saved locally.'
                  : 'Are you sure to remove the local vault key? You will need to input it when you login again.'
              }
              confirmBeforeToggle
            />
          </div>
          <div className="form-row pad-top-sm">
            <BooleanSetting
              label="Enable vault in scripts"
              help="Allow pre-request and after-response script to access vault secrets."
              setting="enableVaultInScripts"
            />
          </div>
        </>
      )}
      {/* User has not input vault key after re-login */}
      {vaultSaltExists && !vaultKeyExists && (
        <div className="form-row pad-top-sm justify-start">
          <Button
            className="btn btn--outlined btn--super-compact flex w-48 items-center"
            onPress={() => setShowModal(true)}
          >
            Enter Vault Key
            <HelpTooltip className="space-left">Enter your vault key to unlock all local secrets.</HelpTooltip>
          </Button>
        </div>
      )}
      {showInputVaultKeyModal && <InputVaultKeyModal onClose={handleModalClose} />}
    </div>
  );
};
