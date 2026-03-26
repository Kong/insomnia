import React, { useEffect, useState } from 'react';
import { Button, Dialog, Heading, Input, Modal, ModalOverlay } from 'react-aria-components';

import { services } from '~/insomnia-data';
import { useRootLoaderData } from '~/root';
import { useResetVaultKeyFetcher } from '~/routes/auth.reset-vault-key';
import { useValidateVaultKeyActionFetcher } from '~/routes/auth.validate-vault-key';
import { useOrganizationLoaderData } from '~/routes/organization';
import { PromptButton } from '~/ui/components/base/prompt-button';
import { Icon } from '~/ui/components/icon';
import { VaultKeyDisplayInput } from '~/ui/components/settings/vault-key-panel';

export interface InputVaultKeyModalProps {
  onClose: (vaultKey?: string) => void;
  allowClose?: boolean;
}

export const InputVaultKeyModal = (props: InputVaultKeyModalProps) => {
  const { onClose, allowClose = true } = props;
  const { userSession } = useRootLoaderData()!;
  const [vaultKey, setVaultKey] = useState('');
  const [error, setError] = useState('');
  const [resetDone, setResetDone] = useState(false);
  const resetVaultKeyFetcher = useResetVaultKeyFetcher();
  const validateVaultKeyFetcher = useValidateVaultKeyActionFetcher();
  const { organizations } = useOrganizationLoaderData()!;
  const isLoading = resetVaultKeyFetcher.state !== 'idle' || validateVaultKeyFetcher.state !== 'idle';

  useEffect(() => {
    // close modal and return new vault key after reset
    if (resetVaultKeyFetcher.data && !resetVaultKeyFetcher.data.error && resetVaultKeyFetcher.state === 'idle') {
      const newVaultKey = resetVaultKeyFetcher.data.key || '';
      setVaultKey(newVaultKey);
      setResetDone(true);
    }
  }, [resetVaultKeyFetcher.data, resetVaultKeyFetcher.state]);

  useEffect(() => {
    if (resetVaultKeyFetcher?.data?.error && resetVaultKeyFetcher.state === 'idle') {
      setError(resetVaultKeyFetcher.data.error);
    }
  }, [resetVaultKeyFetcher.data, resetVaultKeyFetcher.state]);

  useEffect(() => {
    (async () => {
      // close modal and return user input vault key if srp validation success
      if (
        validateVaultKeyFetcher.data &&
        !validateVaultKeyFetcher.data.error &&
        validateVaultKeyFetcher.state === 'idle'
      ) {
        onClose(validateVaultKeyFetcher.data.vaultKey);
      }
    })();
  }, [validateVaultKeyFetcher.data, validateVaultKeyFetcher.state, onClose, userSession]);

  useEffect(() => {
    if (validateVaultKeyFetcher?.data?.error && validateVaultKeyFetcher.state === 'idle') {
      setError(validateVaultKeyFetcher.data.error);
    }
  }, [validateVaultKeyFetcher.data, validateVaultKeyFetcher.state]);

  const handleValidateVaultKey = () => {
    setError('');
    validateVaultKeyFetcher.submit({
      vaultKey,
      saveVaultKey: true,
    });
  };

  return (
    <ModalOverlay
      isOpen
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      className="fixed top-0 left-0 z-10 flex h-(--visual-viewport-height) w-full items-start justify-center bg-black/30"
    >
      <Modal
        className="m-24 flex max-h-[75%] w-full max-w-3xl flex-col overflow-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-(--padding-lg) text-(--color-font)"
        data-testid="input-vault-key-modal"
      >
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-hidden">
          {({ close }) => (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <Heading slot="title" className="text-2xl">
                  {resetDone ? 'Reset Vault Key' : 'Enter Vault Key'}
                </Heading>
                {allowClose && (
                  <Button
                    className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                    onPress={close}
                  >
                    <Icon icon="x" />
                  </Button>
                )}
              </div>
              {!resetDone ? (
                <>
                  <div className="flex w-full shrink-0 grow basis-12 flex-col gap-3 rounded-sm select-none">
                    <label>Unlock all secrets by entering the vault key</label>
                    <Input
                      className="w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font)"
                      placeholder="Enter Vault Key"
                      value={vaultKey}
                      onChange={e => setVaultKey(e.target.value)}
                      aria-label="Vault Key Input"
                    />
                  </div>
                  {error && <p className="notice error margin-top-sm no-margin-bottom">{error}</p>}
                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <span className="faint text-sm">Forget Vault Key?</span>
                      <PromptButton
                        className="h-full px-4 py-1 text-sm text-(--color-info) underline transition-all"
                        onClick={async () => {
                          await services.environment.removeAllSecrets(organizations.map(org => org.id));
                          resetVaultKeyFetcher.submit();
                        }}
                      >
                        Reset Vault Key
                      </PromptButton>
                    </div>
                    <Button
                      className="ml-4 flex items-center gap-2 rounded-xs border border-solid border-(--hl-md) bg-(--color-surprise) px-3 py-2 text-(--color-font-surprise) transition-colors hover:bg-(--color-surprise)/90 hover:no-underline"
                      onPress={handleValidateVaultKey}
                      isDisabled={isLoading || !vaultKey}
                    >
                      {isLoading && (
                        <Icon icon="spinner" className="m-auto mr-2 inline-block animate-spin text-(--color-font)" />
                      )}
                      Unlock
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div>Please save or download the vault key which will be needed when you login again.</div>
                  <VaultKeyDisplayInput vaultKey={vaultKey} />
                  <div className="mt-2 flex items-center justify-end">
                    <Button
                      className="ml-4 flex items-center gap-2 rounded-xs border border-solid border-(--hl-md) bg-(--color-surprise) px-3 py-2 text-(--color-font-surprise) transition-colors hover:bg-(--color-surprise)/90 hover:no-underline"
                      onPress={() => onClose(vaultKey)}
                    >
                      OK
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
