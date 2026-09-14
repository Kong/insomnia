import React, { useState } from 'react';
import { Button } from 'react-aria-components';
import * as reactUse from 'react-use';

import { getProductName } from '~/common/constants';
import { CopyButton } from '~/ui/components/base/copy-button';

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
