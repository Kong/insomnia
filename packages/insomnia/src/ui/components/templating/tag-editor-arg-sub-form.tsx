import React from 'react';

import type { BaseModel } from '../../../models';
import type { NunjucksParsedTag } from '../../../templating/types';
import { isValidJSONString } from '../../../utils/json';
import { ExternalVaultForm } from './external-vault/external-vault-form';

export interface ArgConfigFormProps {
  configValue: string;
  activeTagDefinition: NunjucksParsedTag;
  activeTagData: NunjucksParsedTag;
  onChange: (newConfigValue: string) => void;
  docs: Record<string, BaseModel[]>;
}
const formTagNameMapping = {
  vault: ExternalVaultForm,
};
const isValidJSONObjectString = (input: string) => {
  if (isValidJSONString(input)) {
    const parsedContent = JSON.parse(input);
    // Check if the parsed JSON is an real object.
    return typeof parsedContent === 'object' && parsedContent !== null && !Array.isArray(parsedContent);
  }
  return false;
};
export const couldRenderForm = (name: string) => name in formTagNameMapping;

export const ArgConfigSubForm = (props: ArgConfigFormProps) => {
  const { configValue, activeTagDefinition } = props;
  const tagName = activeTagDefinition.name as keyof typeof formTagNameMapping;
  const ConfigForm = formTagNameMapping[tagName];

  if (ConfigForm && isValidJSONObjectString(configValue)) {
    return <ConfigForm {...props} />;
  }
  return configValue;
};
