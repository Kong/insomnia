import React, { useEffect, useState } from 'react';

import { type HashiCorpSecretConfig, type HashiCorpVaultKVV1SecretConfig, type HashiCorpVaultKVV2SecretConfig, type HCPSecretConfig } from '../../../../main/ipc/cloud-service-integration/types';
import * as models from '../../../../models';
import { type HashiCorpCredentials, HashiCorpCredentialType } from '../../../../models/cloud-credential';
import type { NunjucksParsedTag } from '../../../../templating/types';
import { HelpTooltip } from '../../help-tooltip';

export interface HashiCorpVaultFormProps {
  formData: HashiCorpSecretConfig;
  onChange: (newConfig: HashiCorpSecretConfig) => void;
  activeTagData: NunjucksParsedTag;
}
type KeysOfUnion<T> = T extends T ? keyof T : never;

export const HashiCorpVaultForm = (props: HashiCorpVaultFormProps) => {
  const { formData, onChange, activeTagData } = props;
  const {
    secretName,
  } = formData;
  // onPrem secret config
  const { kvVersion = 'v1', secretEnginePath, secretKey } = formData as HashiCorpVaultKVV1SecretConfig | HashiCorpVaultKVV2SecretConfig;
  // cloud secret config
  const { organizationId, projectId, appName, version: cloudSecretVersion } = formData as HCPSecretConfig;
  const credentialId = activeTagData.args[1].value as string;
  const [credentialType, setCredentialType] = useState<HashiCorpCredentialType>();
  const handleOnChange = (name: KeysOfUnion<HashiCorpSecretConfig>, newValue: string) => {
    const newConfig = {
      ...formData,
      [name]: newValue,
    };
    onChange(newConfig as unknown as HashiCorpSecretConfig);
  };

  const getCredentialData = async (credentialId: string) => {
    const providerCredential = await models.cloudCredential.getById(credentialId);
    if (providerCredential) {
      const { credentials } = providerCredential;
      setCredentialType((credentials as HashiCorpCredentials).type);
    }
  };

  useEffect(() => {
    if (credentialId) {
      getCredentialData(credentialId);
    }
  }, [credentialId]);
  return (
    <>
      <div className="form-row">
        <div className="form-control">
          <label>
            Secret Name:
            <input
              name='secretName'
              defaultValue={secretName}
              onChange={e => handleOnChange('secretName', e.target.value)}
            />
          </label>
        </div>
      </div>
      {credentialType === HashiCorpCredentialType.onPrem &&
        <>
          <div className="form-row">
            <div className="form-control">
              <label>
                KV Secret Engine Version:
              </label>
              <div className='mt-2 flex flex-row'>
                <input
                  type="radio"
                  id="kvVersionChoice-v1"
                  name="kvVersion"
                  className='mr-2'
                  value='v1'
                  checked={kvVersion === 'v1'}
                  onChange={() => handleOnChange('kvVersion', 'v1')}
                />
                <label className="pt-0 mr-8" htmlFor="hashiCorpEnvironmentTypeChoice-onPrem">V1</label>

                <input
                  type="radio"
                  id="kvVersionChoice-v2"
                  name="kvVersion"
                  className='mr-2'
                  value='v2'
                  checked={kvVersion === 'v2'}
                  onChange={() => handleOnChange('kvVersion', 'v2')}
                />
                <label className="pt-0" htmlFor="hashiCorpEnvironmentTypeChoice-cloud">V2</label>
              </div>
            </div>
          </div>
          <div className="form-row">
            <div className="form-control">
              <label>
                Secret Engine Path:
                <input
                  name='secretEnginePath'
                  defaultValue={secretEnginePath}
                  onChange={e => handleOnChange('secretEnginePath', e.target.value)}
                />
              </label>
            </div>
          </div>
          {kvVersion === 'v2' &&
            <div className="form-row">
              <div className="form-control">
                <label>
                  Version:
                  <HelpTooltip className="space-left">
                    Optional version of the secret to retrieve, leave it blank to get latest version
                  </HelpTooltip>
                  <input
                    name='version'
                    defaultValue={(formData as HashiCorpVaultKVV2SecretConfig).version}
                    onChange={e => handleOnChange('version', e.target.value)}
                  />
                </label>
              </div>
            </div>
          }
          <div className="form-row">
            <div className="form-control">
              <label>
                Secret Key:
                <HelpTooltip className="space-left">
                  The secret key of the retrived key-value secrets.
                </HelpTooltip>
                <input
                  name='secretKey'
                  defaultValue={secretKey}
                  onChange={e => handleOnChange('secretKey', e.target.value)}
                />
              </label>
            </div>
          </div>
        </>
      }
      {credentialType === HashiCorpCredentialType.cloud &&
        <>
          <div className="form-row">
            <div className="form-control">
              <label>
                Organization Id:
                <input
                  name='organizationId'
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
                  name='projectId'
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
                  name='appName'
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
                  name='version'
                  defaultValue={cloudSecretVersion}
                  onChange={e => handleOnChange('version', e.target.value)}
                />
              </label>
            </div>
          </div>
        </>
      }
    </>
  );
};
