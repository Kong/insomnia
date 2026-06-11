import React, { useState } from 'react';

import type { NunjucksParsedTag } from '../../../../templating/types';
import { HelpTooltip } from '../../help-tooltip';
import type { AzureSecretConfig } from './types';

export interface AzureKeyVaultFormProps {
  formData: AzureSecretConfig;
  onChange: (newConfig: AzureSecretConfig) => void;
  activeTagData: NunjucksParsedTag;
}

const isValidURL = (url: string) => {
  const regex = /^(https):\/\/[^\s/$.?#].[^\s]*$/i;
  return regex.test(url);
};

export const AzureKeyVaultForm = (props: AzureKeyVaultFormProps) => {
  const { formData, onChange } = props;
  const [isValidIdentifier, setIsValidIdentifier] = useState(true);
  const { secretIdentifier } = formData;
  const handleOnChange = (name: keyof AzureSecretConfig, newValue: string) => {
    const newConfig = {
      ...formData,
      [name]: newValue,
    };
    onChange(newConfig as unknown as AzureSecretConfig);
  };
  return (
    <>
      <div className="form-row">
        <div className="form-control">
          <label>
            Secret Identifier
            <HelpTooltip className="space-left">
              The secret identifier is the URI of the secret in Azure Key Vault. You can get it from your Azure portal.
            </HelpTooltip>
            <input
              name="secretIdentifier"
              defaultValue={secretIdentifier}
              onChange={e => {
                const identifier = e.target.value;
                if (isValidURL(identifier)) {
                  setIsValidIdentifier(true);
                  handleOnChange('secretIdentifier', identifier);
                } else {
                  setIsValidIdentifier(false);
                }
              }}
            />
            {!isValidIdentifier && (
              <p className="notice error mt-(--padding-md) w-full" style={{ marginBottom: 0 }}>
                Invalid Secret Identifier, please check and input again.
              </p>
            )}
          </label>
        </div>
      </div>
    </>
  );
};
