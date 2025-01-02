import React, { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { useFetcher } from 'react-router-dom';

import { type BaseCloudCredential, type CloudProviderCredential, type CloudProviderName, getProviderDisplayName } from '../../../../models/cloud-credential';
import { Icon } from '../../icon';
import { showModal } from '..';
import { SettingsModal, TAB_CLOUD_CREDENTIAL } from '../settings-modal';
import { AWSCredentialForm } from './aws-credential-form';
import { GCPCredentialForm } from './gcp-credential-form';

export interface CloudCredentialModalProps {
  provider: CloudProviderName;
  providerCredential?: CloudProviderCredential;
  onClose: (data?: any) => void;
  onComplete?: (data?: any) => void;
};

export const CloudCredentialModal = (props: CloudCredentialModalProps) => {
  const { provider, providerCredential, onClose, onComplete } = props;
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState('');
  const [manulInputUrl, setManualInputUrl] = useState('');
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

  const handleFormSubmit = (data: BaseCloudCredential & { isAuthenticated?: boolean }) => {
    const { name, credentials, isAuthenticated = false } = data;
    const formAction = isEditing ? `/cloud-credential/${providerCredential._id}/update` : '/cloud-credential/new';
    cloudCredentialFetcher.submit(
      JSON.stringify({ name, credentials, provider, isAuthenticated }),
      {
        action: formAction,
        method: 'post',
        encType: 'application/json',
      }
    );
  };

  const exchangeAzureCode = async () => {
    try {
      setError('');
      const parsedURL = new URL(manulInputUrl);
      const code = parsedURL.searchParams.get('code');
      if (typeof code === 'string') {
        const authResult = await window.main.cloudService.exchangeCode('azure', { code });
        const { success, result, error } = authResult;
        if (success) {
          const { account, uniqueId } = result!;
          handleFormSubmit({
            name: account?.username || uniqueId,
            provider: 'azure',
            credentials: result!,
            isAuthenticated: true,
          });
          showModal(SettingsModal, { tab: TAB_CLOUD_CREDENTIAL });
        } else {
          setError(error!.errorMessage);
        }
      }
    } catch (error) {
      setError(error.toString());
    }
  };

  useEffect(() => {
    // close modal if submit success
    if (cloudCredentialFetcher.data && !cloudCredentialFetcher.data.error && cloudCredentialFetcher.state === 'idle') {
      const newCredentialData = cloudCredentialFetcher.data;
      onClose(newCredentialData);
      onComplete && onComplete(newCredentialData);
    };
  }, [cloudCredentialFetcher.data, cloudCredentialFetcher.state, onClose, onComplete]);

  return (
    <ModalOverlay
      isOpen
      isDismissable
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      className="w-full h-[--visual-viewport-height] fixed z-[9999] top-0 left-0 flex items-start justify-center bg-black/30"
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
                  id="close-add-cloud-crendeital-modal"
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
              {provider === 'azure' &&
                <div className='flex flex-col place-content-center place-items-center p-[--padding-sm] border border-solid border-[--hl-sm] rounded-[--radius-md]'>
                  <a
                    className='cursor-pointer'
                    onClick={() => {
                      setIsAuthenticating(true);
                      window.main.cloudService.openAuthUrl('azure');
                    }}
                  >
                    {isAuthenticating ? 'Authenticating' : 'Click to authenticate'} with Azure
                  </a>
                  {isAuthenticating &&
                    <label className="form-control form-control--outlined">
                      <div className="form-row">
                        <input
                          placeholder='Manually paste the authentication url if you are not redirected'
                          onChange={e => setManualInputUrl(e.target.value)}
                        />
                        <Button
                          className='px-[--padding-md] h-[--line-height-xs] border border-solid border-[--hl-sm]'
                          onPress={() => exchangeAzureCode()}
                        >
                          Authenticate
                        </Button>
                      </div>
                    </label>
                  }
                  {error && (
                    <p className="notice error margin-bottom-sm w-full">
                      {error}
                    </p>
                  )}
                </div>
              }
              {provider === 'gcp' &&
                <GCPCredentialForm
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
