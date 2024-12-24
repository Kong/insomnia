import type { AuthenticationResult } from '@azure/msal-node';
import React, { useState } from 'react';
import { Button, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components';
import { useFetcher } from 'react-router-dom';

import { isDevelopment } from '../../../common/constants';
import { type CloudProviderCredential, type CloudProviderName, getProviderDisplayName } from '../../../models/cloud-credential';
import { usePlanData } from '../../hooks/use-plan';
import { useRootLoaderData } from '../../routes/root';
import { Icon } from '../icon';
import { showModal } from '../modals';
import { AskModal } from '../modals/ask-modal';
import { CloudCredentialModal } from '../modals/cloud-credential-modal/cloud-credential-modal';
import { SvgIcon } from '../svg-icon';
import { Tooltip } from '../tooltip';
import { UpgradeNotice } from '../upgrade-notice';
import { NumberSetting } from './number-setting';

interface createCredentialItemType {
  name: string;
  id: CloudProviderName;
  icon: JSX.Element;
}
const createCredentialItemList: createCredentialItemType[] = [
  {
    id: 'aws',
    name: getProviderDisplayName('aws'),
    icon: <i className="ml-1 fa-brands fa-aws" />,
  },
  {
    id: 'azure',
    name: getProviderDisplayName('azure'),
    icon: <SvgIcon icon='azure-logo' className='ml-1' />,
  },
  {
    id: 'gcp',
    name: getProviderDisplayName('gcp'),
    icon: <SvgIcon icon='gcp-logo' className='ml-1' />,
  },
];
const buttonClassName = 'disabled:opacity-50 h-7 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] transition-all text-sm py-1 px-2';

export const CloudServiceCredentialList = () => {
  const { isOwner, isEnterprisePlan } = usePlanData();
  const { cloudCredentials } = useRootLoaderData();
  const [modalState, setModalState] = useState<{ show: boolean; provider: CloudProviderName; credential?: CloudProviderCredential }>();
  const deleteCredentialFetcher = useFetcher();

  const handleDeleteItem = (id: string, name: string) => {
    showModal(AskModal, {
      title: 'Delete Cloud Credential?',
      message: `Are you sure to delete ${name}?`,
      onDone: async (isYes: boolean) => {
        if (isYes) {
          deleteCredentialFetcher.submit({}, {
            action: `/cloud-credential/${id}/delete`,
            method: 'delete',
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

  const handleCreateCloudServiceCredential = (key: CloudProviderName) => {
    if (key === 'azure' && !isDevelopment()) {
      // open Azure oauth page directly in production
      window.main.cloudService.openAuthUrl('azure');
    } else {
      setModalState({ show: true, provider: key as CloudProviderName });
    }
  };

  if (!isEnterprisePlan) {
    return (
      <UpgradeNotice
        isOwner={isOwner}
        featureName='Cloud Credentials feature'
        newPlan='enterprise'
      />
    );
  }

  return (
    <div>
      <div className='flex justify-between items-end'>
        <h2 className='font-bold text-lg bg-[--color-bg] z-10'>Service Provider Credential List</h2>
        <MenuTrigger>
          <Button
            aria-label="Create in project"
            className="flex items-center justify-center px-4 py-2 gap-2 h-full bg-[--hl-xxs] aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
          >
            <Icon icon="plus-circle" /> Add Credential
          </Button>
          <Popover
            className="min-w-max"
            placement='bottom right'
          >
            <Menu
              aria-label="Create cloud service credential actions"
              selectionMode="single"
              onAction={key => handleCreateCloudServiceCredential(key as CloudProviderName)}
              items={createCredentialItemList}
              className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
            >
              {item => (
                <MenuItem
                  key={item.id}
                  id={item.id}
                  className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xxs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
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
      {cloudCredentials.length === 0 ?
        <div className="text-center faint italic pad">No cloud servicie provider credentials found</div> :
        <table className="table--fancy table--striped table--valign-middle margin-top margin-bottom">
          <thead>
            <tr>
              <th className='normal-case'>Name</th>
              <th className='normal-case'>Service Provider</th>
              <th className='normal-case'>Action</th>
            </tr>
          </thead>
          <tbody>
            {cloudCredentials.map(cloudCred => {
              const { _id, name, provider, credentials } = cloudCred;
              let isTokenExpired = false;
              if (provider === 'azure') {
                const tokenExpiresOn = (credentials as AuthenticationResult).expiresOn;
                if (tokenExpiresOn && new Date() > new Date(tokenExpiresOn)) {
                  isTokenExpired = true;
                }
              };
              const credentialItem = createCredentialItemList.find(item => item.id === provider);
              return (
                <tr key={_id}>
                  <td >
                    {name}
                    {provider === 'azure' && isTokenExpired &&
                      <Tooltip message='Token is expired' position='top'>
                        <i className="ml-1 fa fa-exclamation-circle text-[--color-warning]" />
                      </Tooltip>
                    }
                  </td>
                  <td className='w-36'>
                    {credentialItem && (
                      <div className='flex items-center gap-2'>
                        {credentialItem.icon}
                        <span>{credentialItem.name}</span>
                      </div>
                    )}
                  </td>
                  <td className='w-52 whitespace-nowrap'>
                    <div className='flex gap-2'>
                      {provider !== 'azure' &&
                        <Button
                          className={`${buttonClassName} w-16`}
                          onPress={() => setModalState({ show: true, provider: provider!, credential: cloudCred })}
                        >
                          <Icon icon="edit" />&nbsp;&nbsp;Edit
                        </Button>
                      }
                      {provider === 'azure' && isTokenExpired &&
                        <Button
                          className={`${buttonClassName} w-20`}
                          onPress={() => handleCreateCloudServiceCredential('azure')}
                        >
                          <Icon icon="rotate" /> Renew
                        </Button>
                      }
                      <Button
                        className={`${buttonClassName} w-20`}
                        onPress={() => handleDeleteItem(_id, name)}
                      >
                        <Icon icon="trash" />&nbsp;&nbsp;Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      }
      <div>
        <h2 className='font-bold pt-5 pb-2 text-lg bg-[--color-bg] z-10'>Cloud Secret Config</h2>
        <div className="form-row items-end justify-between">
          <NumberSetting
            label="Secret Cache Duration(min)"
            setting="vaultSecretCacheDuration"
            help="Enter the amount of time in minutes external vault secrets are cached in Insomnia. Enter 0 to disable cache. Click the Reset Cache button to clear all cache."
            min={0}
            max={720}
          />
          <button
            className="w-32 flex items-center gap-2 border border-solid border-[--hl-lg] px-[--padding-md] h-[--line-height-xs] rounded-[--radius-md] hover:bg-[--hl-xs] pointer mb-[--padding-sm] ml-[--padding-sm]"
            onClick={() => window.main.cloudService.clearCache()}
          >
            Reset Cache
          </button>
        </div>
      </div>
      {modalState && modalState.show &&
        <CloudCredentialModal
          provider={modalState.provider}
          providerCredential={modalState.credential}
          onClose={hideModal}
        />
      }
    </div>
  );
};
