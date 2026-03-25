import React from 'react';

import { type CloudProviderCredential, models } from '~/insomnia-data';
import { useRootLoaderData } from '~/root';
import type { NunjucksParsedTag } from '~/templating/types';

import { HelpTooltip } from '../../help-tooltip';
import {
  type HashiCorpSecretConfig,
  type HashiCorpVaultKVV1SecretConfig,
  type HashiCorpVaultKVV2SecretConfig,
  type HCPSecretConfig,
} from './types';

export interface HashiCorpVaultFormProps {
  formData: HashiCorpSecretConfig;
  onChange: (newConfig: HashiCorpSecretConfig) => void;
  activeTagData: NunjucksParsedTag;
}
type HashiCorpCredential = Extract<CloudProviderCredential, { provider: 'hashicorp' }>;
type KeysOfUnion<T> = T extends T ? keyof T : never;

const { HashiCorpCredentialType } = models.cloudCredential;
const defaultKVVersion = 'v2';

export const HashiCorpVaultForm = (props: HashiCorpVaultFormProps) => {
  const { cloudCredentials } = useRootLoaderData()!;

  const { formData, onChange, activeTagData } = props;
  const { secretName } = formData;
  // onPrem secret config
  const {
    kvVersion = defaultKVVersion,
    secretEnginePath,
    secretKey,
    sendNamespaceViaHeader = true,
  } = formData as HashiCorpVaultKVV1SecretConfig | HashiCorpVaultKVV2SecretConfig;
  // cloud secret config
  const { organizationId, projectId, appName, version: cloudSecretVersion } = formData as HCPSecretConfig;
  const credentialId = activeTagData.args[1].value as string;
  const selectedCredential = cloudCredentials.find(c => c._id === credentialId) as unknown as HashiCorpCredential;
  const credentialType = selectedCredential?.credentials?.type;
  const handleOnChange = <T extends KeysOfUnion<HashiCorpSecretConfig>>(
    name: T,
    newValue: string | boolean | number,
  ) => {
    // append default configs when not exist
    const defaultConfig =
      credentialType === HashiCorpCredentialType.cloudVaultSecrets
        ? {}
        : { kvVersion: defaultKVVersion, sendNamespaceViaHeader: true };
    const newConfig = {
      ...defaultConfig,
      ...formData,
      [name]: newValue,
    };
    onChange(newConfig as unknown as HashiCorpSecretConfig);
  };

  return (
    <>
      {(credentialType === HashiCorpCredentialType.onPrem ||
        credentialType === HashiCorpCredentialType.cloudVaultDedicated) && (
        <>
          <div className="form-row">
            <div className="form-control">
              <label>KV Secret Engine Version:</label>
              <div className="mt-2 flex flex-row">
                <input
                  type="radio"
                  id="kvVersionChoice-v1"
                  name="kvVersion"
                  className="mr-2"
                  value="v1"
                  checked={kvVersion === 'v1'}
                  onChange={() => handleOnChange('kvVersion', 'v1')}
                />
                <label className="mr-8 pt-0" htmlFor="kvVersionChoice-v1">
                  V1
                </label>

                <input
                  type="radio"
                  id="kvVersionChoice-v2"
                  name="kvVersion"
                  className="mr-2"
                  value="v2"
                  checked={kvVersion === 'v2'}
                  onChange={() => handleOnChange('kvVersion', 'v2')}
                />
                <label className="pt-0" htmlFor="kvVersionChoice-v2">
                  V2
                </label>
              </div>
            </div>
          </div>
          {credentialType === HashiCorpCredentialType.cloudVaultDedicated && (
            <div className="form-row">
              <div className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={sendNamespaceViaHeader}
                  onChange={e => handleOnChange('sendNamespaceViaHeader', e.target.checked)}
                />
                <span>
                  Send Namespace Via Header
                  <HelpTooltip className="space-left">
                    Whether to send the namespace in the request header. Uncheck this to apply namespace via Secret
                    Mount Path.
                  </HelpTooltip>
                </span>
              </div>
            </div>
          )}
          <div className="form-row">
            <div className="form-control">
              <label>
                Secret Mount Path:
                <HelpTooltip className="space-left">
                  The path where the secrets engine is mounted. It is displayed as the engine name in the UI.
                </HelpTooltip>
                <input
                  name="secretEnginePath"
                  defaultValue={secretEnginePath}
                  onChange={e => handleOnChange('secretEnginePath', e.target.value)}
                />
              </label>
            </div>
          </div>
          <div className="form-row">
            <div className="form-control">
              <label>
                Secret Path:
                <HelpTooltip className="space-left">The path of the secret to read</HelpTooltip>
                <input
                  name="secretName"
                  defaultValue={secretName}
                  onChange={e => handleOnChange('secretName', e.target.value)}
                />
              </label>
            </div>
          </div>
          {kvVersion === 'v2' && (
            <div className="form-row">
              <div className="form-control">
                <label>
                  Version:
                  <HelpTooltip className="space-left">
                    Optional version of the secret to retrieve, leave it blank to get latest version
                  </HelpTooltip>
                  <input
                    name="version"
                    defaultValue={(formData as HashiCorpVaultKVV2SecretConfig).version}
                    onChange={e => handleOnChange('version', e.target.value)}
                  />
                </label>
              </div>
            </div>
          )}
          <div className="form-row">
            <div className="form-control">
              <label>
                Secret Key:
                <HelpTooltip className="space-left">The secret key of the retrived key-value secrets.</HelpTooltip>
                <input
                  name="secretKey"
                  defaultValue={secretKey}
                  onChange={e => handleOnChange('secretKey', e.target.value)}
                />
              </label>
            </div>
          </div>
        </>
      )}
      {credentialType === HashiCorpCredentialType.cloudVaultSecrets && (
        <>
          <div className="form-row">
            <div className="form-control">
              <label>
                Organization Id:
                <input
                  name="organizationId"
                  defaultValue={organizationId}
                  onChange={e => handleOnChange('organizationId', e.target.value)}
                />
              </label>
            </div>
          </div>
          <div className="form-row">
            <div className="form-control">
              <label>
                Project Id:
                <input
                  name="projectId"
                  defaultValue={projectId}
                  onChange={e => handleOnChange('projectId', e.target.value)}
                />
              </label>
            </div>
          </div>
          <div className="form-row">
            <div className="form-control">
              <label>
                App Name:
                <input
                  name="appName"
                  defaultValue={appName}
                  onChange={e => handleOnChange('appName', e.target.value)}
                />
              </label>
            </div>
          </div>
          <div className="form-row">
            <div className="form-control">
              <label>
                Version:
                <HelpTooltip className="space-left">
                  Optional version of the secret to retrieve, leave it blank to get latest version
                </HelpTooltip>
                <input
                  name="version"
                  defaultValue={cloudSecretVersion}
                  onChange={e => handleOnChange('version', e.target.value)}
                />
              </label>
            </div>
          </div>
        </>
      )}
    </>
  );
};
