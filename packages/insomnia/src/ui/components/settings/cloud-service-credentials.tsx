import React, { useEffect, useState } from 'react';
import { Button, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components';

import type { CloudProviderCredential, CloudProviderName } from '~/insomnia-data';
import { models } from '~/insomnia-data';
import { useRootLoaderData } from '~/root';
import { useDeleteCloudCredentialActionFetcher } from '~/routes/cloud-credentials.$cloudCredentialId.delete';

import { EXTERNAL_VAULT_PLUGIN_NAME } from '../../../common/constants';
import { plugins as pluginsBridge } from '../../../plugins/renderer-bridge';
import { usePlanData } from '../../hooks/use-plan';
import { Icon } from '../icon';
import { showError, showModal } from '../modals';
import { AskModal } from '../modals/ask-modal';
import { CloudCredentialModal } from '../modals/cloud-credential-modal/cloud-credential-modal';
import { SvgIcon } from '../svg-icon';
import { Tooltip } from '../tooltip';
import { UpgradeNotice } from '../upgrade-notice';
import { NumberSetting } from './number-setting';

const { getProviderDisplayName } = models.cloudCredential;

interface createCredentialItemType {
  name: string;
  id: CloudProviderName;
  icon: JSX.Element;
}
const createCredentialItemList: createCredentialItemType[] = [
  {
    id: 'aws',
    name: getProviderDisplayName('aws'),
    icon: <i className="fa-brands fa-aws ml-1" />,
  },
  {
    id: 'gcp',
    name: getProviderDisplayName('gcp'),
    icon: <SvgIcon icon="gcp-logo" className="ml-1" />,
  },
  {
    id: 'hashicorp',
    name: getProviderDisplayName('hashicorp'),
    icon: <SvgIcon icon="hashicorp" className="ml-1" />,
  },
  {
    id: 'azure',
    name: getProviderDisplayName('azure'),
    icon: <SvgIcon icon="azure-logo" className="ml-1" />,
  },
];
const buttonClassName =
  'disabled:opacity-50 h-7 aspect-square aria-pressed:bg-(--hl-sm) rounded-xs text-(--color-font) hover:bg-(--hl-xs) transition-all text-sm py-1 px-2';

export const CloudServiceCredentialList = () => {
  const { isOwner, isEnterprisePlan } = usePlanData();
  const { cloudCredentials } = useRootLoaderData()!;
  const [modalState, setModalState] = useState<{
    show: boolean;
    provider: CloudProviderName;
    credential?: CloudProviderCredential;
    authUrl?: string;
  }>();
  const [isVaultPluginInstalled, setIsVaultPluginInstalled] = useState(false);
  const deleteCredentialFetcher = useDeleteCloudCredentialActionFetcher();
  useEffect(() => {
    const checkVaultPlugin = async () => {
      const plugins = await pluginsBridge.getBundlePlugins();
      const vaultPlugin = plugins.find(p => p.name === EXTERNAL_VAULT_PLUGIN_NAME);
      setIsVaultPluginInstalled(!!vaultPlugin);
    };
    checkVaultPlugin();
  }, []);

  const handleDeleteItem = (id: string, name: string) => {
    showModal(AskModal, {
      title: 'Delete Cloud Credential?',
      message: `Are you sure to delete ${name}?`,
      onDone: async (isYes: boolean) => {
        if (isYes) {
          deleteCredentialFetcher.submit({
            cloudCredentialId: id,
          });
        }
      },
    });
  };

  const hideModal = () => {
    setModalState(prevState => {
      const newState = {
        show: false,
        provider: prevState!.provider,
        credentials: undefined,
      };
      return newState;
    });
  };

  const handleCreateCloudServiceCredential = async (key: CloudProviderName) => {
    if (key === 'azure') {
      const { authUrl, error } = (await pluginsBridge.executePluginMainAction({
        pluginName: EXTERNAL_VAULT_PLUGIN_NAME,
        actionName: 'openAuthUrl',
        params: { provider: 'azure' },
      })) as any;
      // show error modal if no authUrl generated
      if (!authUrl) {
        console.error('Failed to open Azure auth url', error);
        showError({
          title: 'Azure Authorization Failed',
          message: error || 'Failed to get Azure authentication url',
        });
      } else {
        setModalState({ show: true, provider: key as CloudProviderName, authUrl });
      }
    } else {
      setModalState({ show: true, provider: key as CloudProviderName });
    }
  };

  if (!isEnterprisePlan) {
    return <UpgradeNotice isOwner={isOwner} featureName="Cloud Credentials feature" newPlan="enterprise" />;
  }
  if (!isVaultPluginInstalled) {
    return (
      <div className="notice pad info flex flex-col items-center justify-center gap-2">
        <p>External vault feature could not be enabled because the required module is missing.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between">
        <h2 className="z-10 bg-(--color-bg) text-lg font-bold">Service Provider Credential List</h2>
        <MenuTrigger>
          <Button
            aria-label="Create Cloud Credential"
            className="flex h-full items-center justify-center gap-2 rounded-xs bg-(--hl-xxs) px-4 py-2 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
          >
            <Icon icon="plus-circle" /> Add Credential
          </Button>
          <Popover className="min-w-max" placement="bottom right">
            <Menu
              aria-label="Create cloud service credential actions"
              selectionMode="single"
              onAction={key => handleCreateCloudServiceCredential(key as CloudProviderName)}
              items={createCredentialItemList}
              className="max-h-[85vh] min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
            >
              {item => (
                <MenuItem
                  key={item.id}
                  id={item.id}
                  className="flex h-(--line-height-xxs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                  aria-label={item.name}
                >
                  {item.icon}
                  <span>{item.name}</span>
                </MenuItem>
              )}
            </Menu>
          </Popover>
        </MenuTrigger>
      </div>
      {cloudCredentials.length === 0 ? (
        <div className="faint pad text-center italic">No cloud service provider credentials found</div>
      ) : (
        <table className="table--fancy table--striped table--valign-middle margin-top margin-bottom">
          <thead>
            <tr>
              <th className="normal-case">Name</th>
              <th className="normal-case">Service Provider</th>
              <th className="normal-case">Action</th>
            </tr>
          </thead>
          <tbody>
            {cloudCredentials.map(cloudCred => {
              const { _id, name, provider, credentials } = cloudCred;
              let isAzureTokenExpired = !credentials;
              if (credentials && provider === 'azure') {
                const tokenExpiresOn = 'expiresOn' in credentials ? credentials.expiresOn : null;
                if (tokenExpiresOn && new Date() >= new Date(tokenExpiresOn)) {
                  isAzureTokenExpired = true;
                }
              }
              const credentialItem = createCredentialItemList.find(item => item.id === provider);
              return (
                <tr key={_id}>
                  <td>
                    {name}
                    {provider === 'azure' && isAzureTokenExpired && (
                      <Tooltip message="Token is expired" position="top">
                        <i className="fa fa-exclamation-circle ml-1 text-(--color-warning)" />
                      </Tooltip>
                    )}
                  </td>
                  <td className="w-36">
                    {credentialItem && (
                      <div className="flex items-center gap-2">
                        {credentialItem.icon}
                        <span>{credentialItem.name}</span>
                      </div>
                    )}
                  </td>
                  <td className="w-52 whitespace-nowrap">
                    <div className="flex gap-2">
                      {provider !== 'azure' && (
                        <Button
                          className={`${buttonClassName} w-16`}
                          onPress={() => setModalState({ show: true, provider: provider!, credential: cloudCred })}
                        >
                          <Icon icon="edit" />
                          &nbsp;&nbsp;Edit
                        </Button>
                      )}
                      {provider === 'azure' && isAzureTokenExpired && (
                        <Button
                          className={`${buttonClassName} w-20`}
                          onPress={() => handleCreateCloudServiceCredential('azure')}
                        >
                          <Icon icon="rotate" /> Renew
                        </Button>
                      )}
                      <Button className={`${buttonClassName} w-20`} onPress={() => handleDeleteItem(_id, name)}>
                        <Icon icon="trash" />
                        &nbsp;&nbsp;Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div>
        <h2 className="z-10 bg-(--color-bg) pt-5 pb-2 text-lg font-bold">Cloud Secret Config</h2>
        <div className="form-row items-end justify-between">
          <NumberSetting
            label="Secret Cache Duration(min)"
            setting="vaultSecretCacheDuration"
            help="Enter the amount of time in minutes external vault secrets are cached in Insomnia. Enter 0 to disable cache. Click the Reset Cache button to clear all cache."
            min={0}
            max={720}
          />
          <button
            className="pointer mb-(--padding-sm) ml-(--padding-sm) flex h-(--line-height-xs) w-32 items-center gap-2 rounded-md border border-solid border-(--hl-lg) px-(--padding-md) hover:bg-(--hl-xs)"
            onClick={async () =>
              await pluginsBridge.executePluginMainAction({
                pluginName: EXTERNAL_VAULT_PLUGIN_NAME,
                actionName: 'clearCache',
              })
            }
          >
            Reset Cache
          </button>
        </div>
      </div>
      {modalState && modalState.show && (
        <CloudCredentialModal
          provider={modalState.provider}
          providerCredential={modalState.credential}
          authUrl={modalState.authUrl}
          onClose={hideModal}
        />
      )}
    </div>
  );
};
