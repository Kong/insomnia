import React from 'react';

import type { NunjucksParsedTag } from '../../../templating/utils';
import { ExternalVaultForm } from './external-vault/external-vault-form';

export interface ArgConfigFormProps {
  configValue: string;
  activeTagDefinition: NunjucksParsedTag;
  activeTagData: NunjucksParsedTag;
  onChange: (newConfigValue: string) => void;
}
const formTagNameMapping = {
  'vault': ExternalVaultForm,
};
const isValidJSONString = (input: string) => {
  try {
    JSON.parse(input);
    return true;
  } catch (error) {
    return false;
  }
};
export const couldRenderForm = (name: string) => name in formTagNameMapping;

export const ArgConfigSubForm = (props: ArgConfigFormProps) => {
  const { configValue, activeTagDefinition } = props;
  const tagName = activeTagDefinition.name as keyof typeof formTagNameMapping;
  const ConfigForm = formTagNameMapping[tagName];

  if (ConfigForm && isValidJSONString(configValue)) {
    return <ConfigForm {...props} />;
  }
  return configValue;
};
