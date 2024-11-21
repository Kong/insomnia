import React, { useState } from 'react';
import { Button } from 'react-aria-components';

import { useRootLoaderData } from '../../routes/root';
import { CopyButton } from '../base/copy-button';
import { HelpTooltip } from '../help-tooltip';
import { InputVaultKeyModal } from '../modals/input-valut-key-modal';
import { BooleanSetting } from './boolean-setting';

export const VaultKeyPanel = () => {
  const {
    settings,
  } = useRootLoaderData();
  const [showModal, setShowModal] = useState(false);

  const generateVaultKey = () => {
    setShowModal(true);
  };

  return (
    <div>
      <div className="form-row pad-top-sm justify-start">
        <Button
          className="flex items-center w-48 btn btn--outlined btn--super-compact"
          onPress={generateVaultKey}
        >
          Generate Vault Key
          <HelpTooltip className="space-left">
            Generate an encryption key to save secrets in private environment. This ensures all secrets are securely stored and encrypted locally.
          </HelpTooltip>
        </Button>
      </div>

      <div className="form-row pad-top-sm flex-col">
        <div className="mb-[var(--padding-xs)]">
          <span className="font-semibold">Vault Key</span>
          <HelpTooltip className="space-left">
            The vault key will be needed when you login after logout.
          </HelpTooltip>
        </div>
        <div className="flex items-center gap-3 bg-[--hl-xs] px-2 py-1 border border-solid border-[--hl-sm] w-full">
          <div className="w-[calc(100%-50px)] truncate">426ff10f505ff0fa97b71c13413a54c511ebd0b42bda64d534044fa77359fde1</div>
          <CopyButton
            size="small"
            content={'Vault Key'}
            title="Copy Vault Key"
            style={{ borderWidth: 0 }}
          >
            <i className="fa fa-copy" />
          </CopyButton>
          <Button>
            <i className="fa-solid fa-download" />
          </Button>
        </div>
      </div>
      <div className="form-row pad-top-sm">
        <BooleanSetting
          label="Save vault key to OS native secret manager"
          setting="saveVaultKeyToOSSecretManager"
        />
      </div>
      {showModal &&
        <InputVaultKeyModal
          onClose={() => setShowModal(false)}
        />
      }
    </div>
  );
};
