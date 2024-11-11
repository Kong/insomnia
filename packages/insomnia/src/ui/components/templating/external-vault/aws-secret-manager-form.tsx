import React, { useState } from 'react';

import type { AWSSecretConfig } from '../../../../main/ipc/cloud-service-integration/types';
import { HelpTooltip } from '../../help-tooltip';

export interface AWSSecretManagerFormProps {
  formData: AWSSecretConfig;
  onChange: (newConfig: AWSSecretConfig) => void;
}
const secretTypeOptions = [
  {
    key: 'plaintext',
    label: 'Plaintext',
  },
  {
    key: 'kv',
    label: 'Key/Value',
  },
];

export const AWSSecretManagerForm = (props: AWSSecretManagerFormProps) => {
  const { formData, onChange } = props;
  const {
    SecretId,
    SecretType,
    VersionId = '',
    VersionStage = '',
    SecretKey = '',
  } = formData;
  const [showSecretKeyInput, setShowSecretKeyInput] = useState(SecretType === 'kv');
  const handleOnChange = (name: keyof AWSSecretConfig) => {
    const formElement = document.getElementById('aws-secret-manager-form') as HTMLFormElement;
    if (formElement) {
      const formData = new FormData(formElement);
      const newConfig = Object.fromEntries(formData.entries());
      if (name === 'SecretType') {
        const secretTypeValue = newConfig['SecretType'];
        setShowSecretKeyInput(secretTypeValue === 'kv');
        if (secretTypeValue === 'plaintext') {
          newConfig['SecretKey'] = '';
        }
      };
      onChange(newConfig as unknown as AWSSecretConfig);
    }
  };
  return (
    <form id='aws-secret-manager-form'>
      <div className="form-row">
        <div className="form-control">
          <label>
            Secret Name Or ARN
            <HelpTooltip className="space-left">
              The ARN or name of the secret to retrieve. To retrieve a secret from another account, you must use an ARN.
            </HelpTooltip>
            <input
              name='SecretId'
              defaultValue={SecretId}
              onChange={() => handleOnChange('SecretId')}
            />
          </label>
        </div>
      </div>
      <div className="form-row">
        <div className="form-control">
          <label>
            Version Id
            <HelpTooltip className="space-left">
              Optional unique identifier of the version of the secret to retrieve.
            </HelpTooltip>
            <input
              name='VersionId'
              defaultValue={VersionId}
              onChange={() => handleOnChange('VersionId')}
            />
          </label>
        </div>
      </div>
      <div className="form-row">
        <div className="form-control">
          <label>
            Version Stage
            <HelpTooltip className="space-left">
              Optional staging label of the version of the secret to retrieve.
            </HelpTooltip>
            <input
              name='VersionStage'
              defaultValue={VersionStage}
              onChange={() => handleOnChange('VersionStage')}
            />
          </label>
        </div>
      </div>
      <div className="form-row">
        <div className="form-control">
          <label>
            Secret Type
            <select
              name='SecretType'
              defaultValue={SecretType || 'plaintext'}
              onChange={() => handleOnChange('SecretType')}
            >
              {secretTypeOptions.map(option => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {showSecretKeyInput &&
        <div className="form-row">
          <div className="form-control">
            <label>
              Secret Key
              <HelpTooltip className="space-left">
                The Secret Key of the retrived key/value secrets.
              </HelpTooltip>
              <input
                name='SecretKey'
                defaultValue={SecretKey}
                onChange={() => handleOnChange('SecretKey')}
              />
            </label>
          </div>
        </div>
      }
    </form>
  );
};
