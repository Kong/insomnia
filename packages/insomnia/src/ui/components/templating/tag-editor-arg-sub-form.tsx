import type { BaseModel } from 'insomnia-data';
import React from 'react';

import type { NunjucksParsedTag } from '../../../templating/types';
import { isBase64String, isValidJSONString } from '../../../utils/string-check';
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

const parseConfigValue = (input: string) => {
  let parsedContent;
  if (isValidJSONString(input)) {
    parsedContent = JSON.parse(input);
  } else if (isBase64String(input)) {
    const decodedString = atob(input);
    parsedContent = isValidJSONString(decodedString) ? JSON.parse(decodedString) : decodedString;
  }
  // check the parsed content is a valid JSON object
  const isValidConfigValue =
    typeof parsedContent === 'object' && parsedContent !== null && !Array.isArray(parsedContent);
  return {
    isValid: isValidConfigValue,
    parsedContent: JSON.stringify(parsedContent),
  };
};
export const couldRenderForm = (name: string) => name in formTagNameMapping;

export const ArgConfigSubForm = (props: ArgConfigFormProps) => {
  const { configValue, ...restProps } = props;
  const tagName = props.activeTagDefinition.name as keyof typeof formTagNameMapping;
  const ConfigForm = formTagNameMapping[tagName];
  const { isValid, parsedContent } = parseConfigValue(configValue);
  if (ConfigForm && isValid) {
    return <ConfigForm {...restProps} configValue={parsedContent} />;
  }
  return configValue;
};
