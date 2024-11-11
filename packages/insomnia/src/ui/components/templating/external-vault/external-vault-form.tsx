import React from 'react';

import { debounce } from '../../../../common/misc';
import type { AWSSecretConfig } from '../../../../main/ipc/cloud-service-integration/types';
import type { ArgConfigFormProps } from '../tag-editor-arg-sub-form';
import { AWSSecretManagerForm } from './aws-secret-manager-form';

export const ExternalVaultForm = (props: ArgConfigFormProps) => {
  const { onChange, configValue, activeTagData } = props;
  const formData = JSON.parse(configValue) as AWSSecretConfig;
  const provider = activeTagData.args[0].value;

  const handleFormChange = debounce((newConfig: AWSSecretConfig) => {
    const newFormValue = JSON.stringify(newConfig);
    onChange(newFormValue);
  }, 1000);

  switch (provider) {
    case 'aws':
      return <AWSSecretManagerForm formData={formData} onChange={handleFormChange} />;
    default:
      return null;
  };
};
