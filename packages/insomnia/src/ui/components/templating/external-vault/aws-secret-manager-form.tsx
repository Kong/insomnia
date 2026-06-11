import React, { useState } from 'react';

import type { NunjucksParsedTag } from '../../../../templating/types';
import { HelpTooltip } from '../../help-tooltip';
import type { AWSSecretConfig } from './types';

export interface AWSSecretManagerFormProps {
  formData: AWSSecretConfig;
  onChange: (newConfig: AWSSecretConfig) => void;
  activeTagData: NunjucksParsedTag;
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
  const { SecretId, SecretType, VersionId = '', VersionStage = '', SecretKey = '' } = formData;
  const [showSecretKeyInput, setShowSecretKeyInput] = useState(SecretType === 'kv');
  const handleOnChange = (name: keyof AWSSecretConfig, newValue: string) => {
    const newConfig = {
      ...formData,
      [name]: newValue,
    };
    if (name === 'SecretType') {
      setShowSecretKeyInput(newValue === 'kv');
      if (newValue === 'plaintext') {
        newConfig['SecretKey'] = '';
      }
    }
    onChange(newConfig as unknown as AWSSecretConfig);
  };
  return (
    <>
      <div className="form-row">
        <div className="form-control">
          <label>
            Secret Name Or ARN
            <HelpTooltip className="space-left">
              The ARN or name of the secret to retrieve. To retrieve a secret from another account, you must use an ARN.
            </HelpTooltip>
            <input name="SecretId" defaultValue={SecretId} onChange={e => handleOnChange('SecretId', e.target.value)} />
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
              name="VersionId"
              defaultValue={VersionId}
              onChange={e => handleOnChange('VersionId', e.target.value)}
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
              name="VersionStage"
              defaultValue={VersionStage}
              onChange={e => handleOnChange('VersionStage', e.target.value)}
            />
          </label>
        </div>
      </div>
      <div className="form-row">
        <div className="form-control">
          <label>
            Secret Type
            <select
              name="SecretType"
              defaultValue={SecretType || 'plaintext'}
              onChange={e => handleOnChange('SecretType', e.target.value)}
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
      {showSecretKeyInput && (
        <div className="form-row">
          <div className="form-control">
            <label>
              Secret Key
              <HelpTooltip className="space-left">The secret key of the retrived key-value secrets.</HelpTooltip>
              <input
                name="SecretKey"
                defaultValue={SecretKey}
                onChange={e => handleOnChange('SecretKey', e.target.value)}
              />
            </label>
          </div>
        </div>
      )}
    </>
  );
};
