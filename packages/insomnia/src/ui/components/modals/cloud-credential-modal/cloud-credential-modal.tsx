import React, { useEffect, useMemo } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { useFetcher } from 'react-router-dom';

import { type BaseCloudCredential, type CloudProviderCredential, type CloudProviderName, getProviderDisplayName } from '../../../../models/cloud-credential';
import { Icon } from '../../icon';
import { AWSCredentialForm } from './aws-credential-form';

export interface CloudCredentialModalProps {
  provider: CloudProviderName;
  providerCredential?: CloudProviderCredential;
  onClose: (data?: any) => void;
};

export const CloudCredentialModal = (props: CloudCredentialModalProps) => {
  const { provider, providerCredential, onClose } = props;
  const providerDisplayName = getProviderDisplayName(provider);
  const cloudCredentialFetcher = useFetcher();
  const isEditing = !!providerCredential;

  const fetchErrorMessage = useMemo(() => {
    if (cloudCredentialFetcher.data && 'error' in cloudCredentialFetcher.data && cloudCredentialFetcher.data.error && cloudCredentialFetcher.state === 'idle') {
      const errorMessage: string = cloudCredentialFetcher.data.error || `An unexpected error occurred while authenticating with ${getProviderDisplayName(provider)}.`;
      return errorMessage;
    }
    return undefined;
  }, [cloudCredentialFetcher.data, cloudCredentialFetcher.state, provider]);

  const handleFormSubmit = (data: BaseCloudCredential) => {
    const { name, credentials } = data;
    const formAction = isEditing ? `/cloud-credential/${providerCredential._id}/update` : '/cloud-credential/new';
    cloudCredentialFetcher.submit(
      JSON.stringify({ name, credentials, provider }),
      {
        action: formAction,
        method: 'post',
        encType: 'application/json',
      }
    );
  };

  useEffect(() => {
    // close modal if submit success
    if (cloudCredentialFetcher.data && !cloudCredentialFetcher.data.error && cloudCredentialFetcher.state === 'idle') {
      onClose(cloudCredentialFetcher.data);
    };
  }, [cloudCredentialFetcher.data, cloudCredentialFetcher.state, onClose]);

  return (
    <ModalOverlay
      isOpen
      isDismissable
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-start justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
        className="max-h-[75%] overflow-auto flex flex-col w-full max-w-3xl rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] bg-[--color-bg] text-[--color-font] m-24"
      >
        <Dialog
          className="outline-none flex-1 h-full flex flex-col overflow-hidden"
        >
          {({ close }) => (
            <div className='flex-1 flex flex-col gap-4 overflow-hidden'>
              <div className='flex gap-2 items-center justify-between'>
                <Heading slot="title" className='text-2xl'>{providerCredential ? `Edit ${providerDisplayName} credential` : `Authenticate With ${providerDisplayName}`}</Heading>
                <Button
                  className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              {provider === 'aws' &&
                <AWSCredentialForm
                  data={providerCredential}
                  isLoading={cloudCredentialFetcher.state !== 'idle'}
                  onSubmit={handleFormSubmit}
                  errorMessage={fetchErrorMessage}
                />
              }
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
