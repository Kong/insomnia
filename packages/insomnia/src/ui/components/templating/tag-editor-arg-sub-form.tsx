import React from 'react';

import { isBase64String, isValidJSONString } from '~/ui/utils/string-check';

import { ExternalVaultForm } from './external-vault/external-vault-form';
import type { ArgConfigFormProps } from './tag-editor-arg-sub-form.types';

export type { ArgConfigFormProps } from './tag-editor-arg-sub-form.types';

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
