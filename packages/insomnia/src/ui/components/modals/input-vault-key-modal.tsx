import React, { useEffect, useState } from 'react';
import { Button, Dialog, Heading, Input, Modal, ModalOverlay } from 'react-aria-components';
import { useFetcher, useRouteLoaderData } from 'react-router';

import { removeAllSecrets } from '../../../models/environment';
import type { OrganizationLoaderData } from '../../routes/organization';
import { useRootLoaderData } from '../../routes/root';
import { Icon } from '../icon';
import { VaultKeyDisplayInput } from '../settings/vault-key-panel';
import { showModal } from '.';
import { AskModal } from './ask-modal';

export interface InputVaultKeyModalProps {
  onClose: (vaultKey?: string) => void;
  allowClose?: boolean;
}

export const InputVaultKeyModal = (props: InputVaultKeyModalProps) => {
  const { onClose, allowClose = true } = props;
  const { userSession } = useRootLoaderData();
  const [vaultKey, setVaultKey] = useState('');
  const [error, setError] = useState('');
  const [resetDone, setResetDone] = useState(false);
  const resetVaultKeyFetcher = useFetcher();
  const validateVaultKeyFetcher = useFetcher();
  const { organizations } = useRouteLoaderData('/organization') as OrganizationLoaderData;
  const isLoading = resetVaultKeyFetcher.state !== 'idle' || validateVaultKeyFetcher.state !== 'idle';

  useEffect(() => {
    // close modal and return new vault key after reset
    if (resetVaultKeyFetcher.data && !resetVaultKeyFetcher.data.error && resetVaultKeyFetcher.state === 'idle') {
      const newVaultKey = resetVaultKeyFetcher.data;
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
    validateVaultKeyFetcher.submit(
      {
        vaultKey,
        saveVaultKey: true,
      },
      {
        action: '/auth/validateVaultKey',
        method: 'POST',
        encType: 'application/json',
      },
    );
  };

  const resetVaultKey = () => {
    showModal(AskModal, {
      title: 'Reset Vault Key',
      message:
        'Are you sure you sure to reset vault key? This will clear all secrets in private environment among all devices.',
      yesText: 'Yes',
      noText: 'No',
      onDone: async (yes: boolean) => {
        if (yes) {
          // clear all local secrets first
          await removeAllSecrets(organizations.map(org => org.id));
          resetVaultKeyFetcher.submit('', {
            action: '/auth/resetVaultKey',
            method: 'POST',
          });
        }
      },
    });
  };

  return (
    <ModalOverlay
      isOpen
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      className="fixed left-0 top-0 z-10 flex h-[--visual-viewport-height] w-full items-start justify-center bg-black/30"
    >
      <Modal
        className="m-24 flex max-h-[75%] w-full max-w-3xl flex-col overflow-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] p-[--padding-lg] text-[--color-font]"
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
        data-testid="input-vault-key-modal"
      >
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-none">
          {({ close }) => (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <Heading slot="title" className="text-2xl">
                  {resetDone ? 'Reset Vault Key' : 'Enter Vault Key'}
                </Heading>
                {allowClose && (
                  <Button
                    className="flex aspect-square h-6 flex-shrink-0 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                    onPress={close}
                  >
                    <Icon icon="x" />
                  </Button>
                )}
              </div>
              {!resetDone ? (
                <>
                  <div className="flex w-full shrink-0 grow basis-12 select-none flex-col gap-3 rounded">
                    <label>Unlock all secrets by entering the vault key</label>
                    <Input
                      className="w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font]"
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
                      <Button
                        className="h-full px-4 py-1 text-sm text-[--color-info] underline transition-all"
                        onPress={resetVaultKey}
                      >
                        Reset Vault Key
                      </Button>
                    </div>
                    <Button
                      className="ml-4 flex items-center gap-2 rounded-sm border border-solid border-[--hl-md] bg-[--color-surprise] px-3 py-2 text-[--color-font-surprise] transition-colors hover:bg-opacity-90 hover:no-underline"
                      onPress={handleValidateVaultKey}
                      isDisabled={isLoading || !vaultKey}
                    >
                      {isLoading && (
                        <Icon icon="spinner" className="m-auto mr-2 inline-block animate-spin text-[--color-font]" />
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
                      className="ml-4 flex items-center gap-2 rounded-sm border border-solid border-[--hl-md] bg-[--color-surprise] px-3 py-2 text-[--color-font-surprise] transition-colors hover:bg-opacity-90 hover:no-underline"
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
