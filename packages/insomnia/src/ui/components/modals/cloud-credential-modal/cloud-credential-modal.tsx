import React, { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { useFetcher } from 'react-router-dom';

import {
  type BaseCloudCredential,
  type CloudProviderCredential,
  type CloudProviderName,
  getProviderDisplayName,
} from '../../../../models/cloud-credential';
import { Icon } from '../../icon';
import { showModal } from '..';
import { SettingsModal, TAB_CLOUD_CREDENTIAL } from '../settings-modal';
import { AWSCredentialForm } from './aws-credential-form';
import { GCPCredentialForm } from './gcp-credential-form';
import { HashiCorpCredentialForm } from './hashicorp-credential-form';

export interface CloudCredentialModalProps {
  provider: CloudProviderName;
  providerCredential?: CloudProviderCredential;
  onClose: (data?: any) => void;
  onComplete?: (data?: any) => void;
}

export const CloudCredentialModal = (props: CloudCredentialModalProps) => {
  const { provider, providerCredential, onClose, onComplete } = props;
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState('');
  const [manulInputUrl, setManualInputUrl] = useState('');
  const providerDisplayName = getProviderDisplayName(provider);
  const cloudCredentialFetcher = useFetcher();
  const isEditing = !!providerCredential;

  const fetchErrorMessage = useMemo(() => {
    if (
      cloudCredentialFetcher.data &&
      'error' in cloudCredentialFetcher.data &&
      cloudCredentialFetcher.data.error &&
      cloudCredentialFetcher.state === 'idle'
    ) {
      const errorMessage: string =
        cloudCredentialFetcher.data.error ||
        `An unexpected error occurred while authenticating with ${getProviderDisplayName(provider)}.`;
      return errorMessage;
    }
    return undefined;
  }, [cloudCredentialFetcher.data, cloudCredentialFetcher.state, provider]);

  const handleFormSubmit = (data: BaseCloudCredential & { isAuthenticated?: boolean }) => {
    const { name, credentials, isAuthenticated = false } = data;
    const formAction = isEditing ? `/cloud-credential/${providerCredential._id}/update` : '/cloud-credential/new';
    cloudCredentialFetcher.submit(JSON.stringify({ name, credentials, provider, isAuthenticated }), {
      action: formAction,
      method: 'post',
      encType: 'application/json',
    });
  };

  const exchangeAzureCode = async () => {
    try {
      setError('');
      const parsedURL = new URL(manulInputUrl);
      const code = parsedURL.searchParams.get('code');
      if (code && typeof code === 'string') {
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
      } else {
        const errorDetail = Object.fromEntries(parsedURL.searchParams.entries());
        setError(`Error authorizing Azure ${JSON.stringify(errorDetail) || 'Unknown error'}`);
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
    }
  }, [cloudCredentialFetcher.data, cloudCredentialFetcher.state, onClose, onComplete]);

  return (
    <ModalOverlay
      isOpen
      isDismissable
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      className="fixed left-0 top-0 z-[9999] flex h-[--visual-viewport-height] w-full items-start justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
        className="m-24 flex max-h-[75%] w-full max-w-3xl flex-col overflow-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] p-[--padding-lg] text-[--color-font]"
      >
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-none">
          {({ close }) => (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <Heading slot="title" className="text-2xl">
                  {providerCredential
                    ? `Edit ${providerDisplayName} credential`
                    : `Authenticate With ${providerDisplayName}`}
                </Heading>
                <Button
                  className="flex aspect-square h-6 flex-shrink-0 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                  id="close-add-cloud-crendeital-modal"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              {provider === 'aws' && (
                <AWSCredentialForm
                  data={providerCredential}
                  isLoading={cloudCredentialFetcher.state !== 'idle'}
                  onSubmit={handleFormSubmit}
                  errorMessage={fetchErrorMessage}
                />
              )}
              {provider === 'gcp' && (
                <GCPCredentialForm
                  data={providerCredential}
                  isLoading={cloudCredentialFetcher.state !== 'idle'}
                  onSubmit={handleFormSubmit}
                  errorMessage={fetchErrorMessage}
                />
              )}
              {provider === 'hashicorp' && (
                <HashiCorpCredentialForm
                  data={providerCredential}
                  isLoading={cloudCredentialFetcher.state !== 'idle'}
                  onSubmit={handleFormSubmit}
                  errorMessage={fetchErrorMessage}
                />
              )}
              {provider === 'azure' && (
                <div className="flex flex-col place-content-center place-items-center rounded-[--radius-md] border border-solid border-[--hl-sm] p-[--padding-sm]">
                  <a
                    className="cursor-pointer"
                    onClick={() => {
                      setIsAuthenticating(true);
                      window.main.cloudService.openAuthUrl('azure');
                    }}
                  >
                    {isAuthenticating ? 'Authenticating' : 'Click to authenticate'} with Azure
                  </a>
                  {isAuthenticating && (
                    <label className="form-control form-control--outlined">
                      <div className="form-row">
                        <input
                          placeholder="Manually paste the authentication url if you are not redirected"
                          onChange={e => setManualInputUrl(e.target.value)}
                        />
                        <Button
                          className="h-[--line-height-xs] border border-solid border-[--hl-sm] px-[--padding-md]"
                          onPress={() => exchangeAzureCode()}
                        >
                          Authenticate
                        </Button>
                      </div>
                    </label>
                  )}
                  {error && <p className="notice error margin-bottom-sm w-full">{error}</p>}
                </div>
              )}
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
