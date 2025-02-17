import React, { useEffect, useState } from 'react';
import { Button, Dialog, Heading, Input, Modal, ModalOverlay } from 'react-aria-components';
import { useFetcher } from 'react-router-dom';

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
  const isLoading = resetVaultKeyFetcher.state !== 'idle' || validateVaultKeyFetcher.state !== 'idle';

  useEffect(() => {
    // close modal and return new vault key after reset
    if (resetVaultKeyFetcher.data && !resetVaultKeyFetcher.data.error && resetVaultKeyFetcher.state === 'idle') {
      const newVaultKey = resetVaultKeyFetcher.data;
      setVaultKey(newVaultKey);
      setResetDone(true);
    };
  }, [resetVaultKeyFetcher.data, resetVaultKeyFetcher.state]);

  useEffect(() => {
    if (resetVaultKeyFetcher?.data?.error && resetVaultKeyFetcher.state === 'idle') {
      setError(resetVaultKeyFetcher.data.error);
    }
  }, [resetVaultKeyFetcher.data, resetVaultKeyFetcher.state]);

  useEffect(() => {
    (async () => {
      // close modal and return user input vault key if srp validation success
      if (validateVaultKeyFetcher.data && !validateVaultKeyFetcher.data.error && validateVaultKeyFetcher.state === 'idle') {
        onClose(validateVaultKeyFetcher.data.vaultKey);
      };
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
        vaultKey, saveVaultKey: true,
      },
      {
        action: '/auth/validateVaultKey',
        method: 'POST',
        encType: 'application/json',
      });
  };

  const resetVaultKey = () => {
    showModal(AskModal, {
      title: 'Reset Vault Key',
      message: 'Are you sure you sure to reset vault key? This will clear all secrets in private environment among all devices.',
      yesText: 'Yes',
      noText: 'No',
      onDone: async (yes: boolean) => {
        if (yes) {
          // todo clear all local secrets
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
      className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-start justify-center bg-black/30"
    >
      <Modal
        className="max-h-[75%] overflow-auto flex flex-col w-full max-w-3xl rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] bg-[--color-bg] text-[--color-font] m-24"
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
      >
        <Dialog
          className="outline-none flex-1 h-full flex flex-col overflow-hidden"
        >
          {({ close }) => (
            <div className='flex-1 flex flex-col gap-4 overflow-hidden'>
              <div className='flex gap-2 items-center justify-between'>
                <Heading slot="title" className='text-2xl'>
                  {resetDone ? 'Reset Vault Key' : 'Enter Vault Key'}
                </Heading>
                {allowClose &&
                  <Button
                    className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                    onPress={close}
                  >
                    <Icon icon="x" />
                  </Button>
                }
              </div>
              {!resetDone ?
                (
                  <>
                    <div className='rounded grow shrink-0 w-full basis-12 flex flex-col gap-3 select-none'>
                      <label>
                        Unlock all secrets by entering the vault key
                      </label>
                      <Input
                        className='py-1 w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font]'
                        placeholder='Enter Vault Key'
                        value={vaultKey}
                        onChange={e => setVaultKey(e.target.value)}
                      />
                    </div>
                    {error &&
                      <p className="notice error margin-top-sm no-margin-bottom">{error}</p>
                    }
                    <div className="flex justify-between mt-2 items-center">
                      <div>
                        <span className='faint text-sm'>Forget Vault Key?</span>
                        <Button
                          className="px-4 py-1 h-full underline text-[--color-info] text-sm transition-all "
                          onPress={resetVaultKey}
                        >
                          Reset Vault Key
                        </Button>
                      </div>
                      <Button
                        className="hover:no-underline ml-4 flex items-center gap-2 bg-[--color-surprise] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm"
                        onPress={handleValidateVaultKey}
                        isDisabled={isLoading || !vaultKey}
                      >
                        {isLoading && <Icon icon="spinner" className="text-[--color-font] animate-spin m-auto inline-block mr-2" />}
                        Unlock
                      </Button>
                    </div>
                  </>
                ) :
                (
                  <>
                    <div>Please save or download the vault key which will be needed when you login again.</div>
                    <VaultKeyDisplayInput vaultKey={vaultKey} />
                    <div className="flex justify-end mt-2 items-center">
                      <Button
                        className="hover:no-underline ml-4 flex items-center gap-2 bg-[--color-surprise] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm"
                        onPress={() => onClose(vaultKey)}
                      >
                        OK
                      </Button>
                    </div>
                  </>
                )
              }
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
