import React, { useCallback, useEffect, useState } from 'react';
import { Button } from 'react-aria-components';
import { useRevalidator } from 'react-router';
import * as reactUse from 'react-use';

import { getProductName } from '~/common/constants';
import { decryptVaultKeyFromSession, deleteVaultKeyFromStorage, saveVaultKeyIfNecessary } from '~/common/utils/vault';
import { CopyButton } from '~/ui/components/base/copy-button';
import { HelpTooltip } from '~/ui/components/help-tooltip';
import { Icon } from '~/ui/components/icon';
import { showError } from '~/ui/components/modals';
import { useRootLoaderData } from '~/ui/hooks/use-root-loader-data';
import { createVaultKey, LOCAL_VAULT_ACCOUNT_ID } from '~/ui/vault-key.client';

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
  const { revalidate } = useRevalidator();
  const [isGenerating, setGenerating] = useState(false);
  const [vaultKeyValue, setVaultKeyValue] = useState('');
  const { vaultKey, vaultSalt } = userSession;
  const accountId = LOCAL_VAULT_ACCOUNT_ID;
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

  const generateVaultKey = async () => {
    setGenerating(true);
    try {
      setVaultKeyValue(await createVaultKey());
      revalidate();
    } catch (err) {
      showError({ title: 'Can not generate vault key', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setGenerating(false);
    }
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
        <div className="form-row form-row--start pad-top-sm justify-start">
          <Button
            className="btn btn--outlined btn--super-compact width-auto flex items-center justify-center gap-2"
            onPress={generateVaultKey}
            isDisabled={isGenerating}
            aria-label="Generate Vault Key"
          >
            {isGenerating && <Icon icon="spinner" className="inline-block animate-spin text-(--color-font)" />}
            Generate Vault Key
            <HelpTooltip>
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
    </div>
  );
};
