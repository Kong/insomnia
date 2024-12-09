import React, { useState } from 'react';

import type { AzureSecretConfig } from '../../../../main/ipc/cloud-service-integraion/types';
import type { NunjucksParsedTag } from '../../../../templating/utils';
import { HelpTooltip } from '../../help-tooltip';

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
  const handleOnChange = () => {
    const formElement = document.getElementById('azure-key-vault-form') as HTMLFormElement;
    if (formElement) {
      const formData = new FormData(formElement);
      const newConfig = Object.fromEntries(formData.entries());
      // only support Azure secret for now
      newConfig.secretType = 'secret';
      onChange(newConfig as unknown as AzureSecretConfig);
    }
  };
  return (
    <form id='azure-key-vault-form'>
      <div className="form-row">
        <div className="form-control">
          <label>
            Secret Identifier
            <HelpTooltip className="space-left">
              The secret identifier is the URI of the secret in Azure Key Vault. You can get it from your Azure portal.
            </HelpTooltip>
            <input
              name='secretIdentifier'
              defaultValue={secretIdentifier}
              onChange={e => {
                const identifier = e.target.value;
                if (isValidURL(identifier)) {
                  setIsValidIdentifier(true);
                  handleOnChange();
                } else {
                  setIsValidIdentifier(false);
                }
              }}
            />
            {!isValidIdentifier &&
              <p className="notice error w-full mt-[--padding-md]" style={{ marginBottom: 0 }}>
                Invalid Secret Identifier, please check and input again.
              </p>
            }
          </label>
        </div>
      </div>
    </form>
  );
};
