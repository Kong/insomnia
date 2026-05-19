import React, { useEffect, useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';

import type { CloudProviderCredential } from '~/insomnia-data';
import { models } from '~/insomnia-data';
import { useUpdateCloudCredentialActionFetcher } from '~/routes/cloud-credentials.$cloudCredentialId.update';
import { useCreateCloudCredentialActionFetcher } from '~/routes/cloud-credentials.create';

import { EXTERNAL_VAULT_PLUGIN_NAME } from '../../../../common/constants';
import { executePluginMainAction } from '../../../../plugins';
import { Icon } from '../../icon';
import { AWSCredentialForm } from './aws-credential-form';
import { GCPCredentialForm } from './gcp-credential-form';
import { HashiCorpCredentialForm } from './hashicorp-credential-form';

const { getProviderDisplayName } = models.cloudCredential;

type BaseCloudCredential = Pick<CloudProviderCredential, 'credentials' | 'provider' | 'name'>;
export interface CloudCredentialModalProps {
  provider: CloudProviderCredential['provider'];
  providerCredential?: CloudProviderCredential;
  authUrl?: string;
  onClose: (data?: any) => void;
  onComplete?: (data?: any) => void;
}

export const CloudCredentialModal = (props: CloudCredentialModalProps) => {
  const { provider, providerCredential, authUrl, onClose, onComplete } = props;
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState('');
  const [manulInputUrl, setManualInputUrl] = useState('');
  const providerDisplayName = getProviderDisplayName(provider);

  const updateCloudCredentialsFetcher = useUpdateCloudCredentialActionFetcher();
  const createCloudCredentialsFetcher = useCreateCloudCredentialActionFetcher();
  const isEditing = !!providerCredential;
  const upsertFetcher = isEditing ? updateCloudCredentialsFetcher : createCloudCredentialsFetcher;

  const fetchErrorMessage = upsertFetcher.data && 'error' in upsertFetcher.data ? upsertFetcher.data.error : '';

  const isLoading = upsertFetcher.state !== 'idle';

  const handleFormSubmit = (data: BaseCloudCredential & { isAuthenticated?: boolean }) => {
    const { name, credentials, isAuthenticated = false } = data;
    const patch = { name, credentials, provider } as Partial<CloudProviderCredential>;

    if (isEditing) {
      return updateCloudCredentialsFetcher.submit({
        patch,
        cloudCredentialId: providerCredential._id,
      });
    }

    return createCloudCredentialsFetcher.submit({
      name,
      credentials,
      provider,
      isAuthenticated,
    });
  };

  const exchangeAzureCode = async () => {
    try {
      setError('');
      setIsAuthenticating(true);
      const parsedURL = new URL(manulInputUrl);
      const code = parsedURL.searchParams.get('code');
      if (code && typeof code === 'string') {
        const authResult = await executePluginMainAction({
          pluginName: EXTERNAL_VAULT_PLUGIN_NAME,
          actionName: 'exchangeCode',
          params: { provider: 'azure', code },
        });
        const { success, result, error } = authResult;
        if (success) {
          const { account, uniqueId } = result!;
          handleFormSubmit({
            name: account?.username || uniqueId,
            provider: 'azure',
            credentials: result!,
            isAuthenticated: true,
          });
        } else {
          setError(error!.errorMessage);
        }
      } else {
        const errorDetail = Object.fromEntries(parsedURL.searchParams.entries());
        setError(`Error authorizing Azure ${JSON.stringify(errorDetail) || 'Unknown error'}`);
      }
    } catch (error) {
      setError(error.toString());
    } finally {
      setIsAuthenticating(false);
    }
  };

  useEffect(() => {
    // close modal if submit success
    if (upsertFetcher.data && !('error' in upsertFetcher.data) && upsertFetcher.state === 'idle') {
      const newCredentialData = upsertFetcher.data;
      onClose(newCredentialData);
      onComplete && onComplete(newCredentialData);
    }
  }, [upsertFetcher.data, upsertFetcher.state, onClose, onComplete]);

  return (
    <ModalOverlay
      isOpen
      isDismissable
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      className="fixed top-0 left-0 z-9999 flex h-(--visual-viewport-height) w-full items-start justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
        className="m-24 flex max-h-[75%] w-full max-w-3xl flex-col overflow-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-(--padding-lg) text-(--color-font)"
      >
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-hidden">
          {({ close }) => (
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
              <div className="flex items-center justify-between gap-2">
                <Heading slot="title" className="text-2xl">
                  {providerCredential
                    ? `Edit ${providerDisplayName} credential`
                    : `Authenticate With ${providerDisplayName}`}
                </Heading>
                <Button
                  className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  id="close-add-cloud-credential-modal"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              {provider === 'aws' && (
                <AWSCredentialForm
                  data={providerCredential}
                  isLoading={isLoading}
                  onSubmit={handleFormSubmit}
                  errorMessage={fetchErrorMessage}
                />
              )}
              {provider === 'gcp' && (
                <GCPCredentialForm
                  isLoading={isLoading}
                  data={providerCredential as Extract<CloudProviderCredential, { provider: 'gcp' }>}
                  onSubmit={handleFormSubmit}
                  errorMessage={fetchErrorMessage}
                />
              )}
              {provider === 'hashicorp' && (
                <HashiCorpCredentialForm
                  isLoading={isLoading}
                  data={providerCredential as Extract<CloudProviderCredential, { provider: 'hashicorp' }>}
                  onSubmit={handleFormSubmit}
                  errorMessage={fetchErrorMessage}
                />
              )}
              {provider === 'azure' && authUrl && (
                <div className="flex flex-col gap-(--padding-md) text-(--color-font)">
                  <p>A new page should have opened in your default web browser to authenticate with Azure.</p>
                  <div className="flex flex-col gap-3 rounded-md bg-(--hl-sm) p-(--padding-md)">
                    <p className="text-start text-[rgba(var(--color-font-rgb),0.8)]">
                      If you were not redirected, please copy and paste the following URL into your browser.
                    </p>
                    <div className="form-control form-control--outlined no-pad-top flex">
                      <input type="text" value={authUrl} className="mr-(--padding-sm)" readOnly />
                      <button
                        className="btn btn--super-compact btn--outlined flex items-center gap-(--padding-xs)"
                        onClick={() => {
                          window.clipboard.writeText(authUrl);
                        }}
                      >
                        <i className="fa fa-clipboard mr-1" aria-hidden="true" />
                        Copy
                      </button>
                    </div>
                    <p className="text-start text-[rgba(var(--color-font-rgb),0.8)]">
                      If your browser does not open the Insomnia app automatically you can manually paste the redirect
                      URL in Azure to here.
                    </p>
                    <div className="form-control form-control--outlined no-pad-top" style={{ display: 'flex' }}>
                      <input
                        type="text"
                        className="mr-(--padding-sm)"
                        placeholder="Manually paste the authentication url if you are not redirected"
                        onChange={e => setManualInputUrl(e.target.value)}
                      />{' '}
                      <button
                        className="btn btn--super-compact btn--outlined flex items-center gap-(--padding-xs)"
                        type="submit"
                        disabled={isAuthenticating}
                        onClick={exchangeAzureCode}
                      >
                        <Icon
                          icon={isAuthenticating ? 'spinner' : 'sign-in'}
                          className={`${isAuthenticating ? 'animate-spin' : ''} mr-1`}
                        />
                        Auth
                      </button>
                    </div>
                  </div>
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
