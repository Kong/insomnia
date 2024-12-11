import React, { useState } from 'react';
import { Button } from 'react-aria-components';

import { debounce } from '../../../../common/misc';
import type { AWSSecretConfig, AzureSecretConfig, ExternalVaultConfig, GCPSecretConfig } from '../../../../main/ipc/cloud-service-integraion/types';
import { type CloudProviderCredential, type CloudProviderName, type } from '../../../../models/cloud-credential';
import { Icon } from '../../icon';
import { CloudCredentialModal } from '../../modals/cloud-credential-modal/cloud-credential-modal';
import type { ArgConfigFormProps } from '../tag-editor-arg-sub-form';
import { AWSSecretManagerForm } from './aws-secret-manager-form';
import { AzureKeyVaultForm } from './azure-key-vault-form';
import { GCPSecretManagerForm } from './gcp-secret-manager-form';

export const ExternalVaultForm = (props: ArgConfigFormProps) => {
  const { onChange, configValue, activeTagData, docs } = props;
  const [showModal, setShowModal] = useState(false);
  const provider = activeTagData.args[0].value as CloudProviderName;
  const formData = JSON.parse(configValue) as ExternalVaultConfig;
  const selectedCredentialId = activeTagData.args[1].value;
  const cloudCredentialDocs = docs[type] as CloudProviderCredential[] || [];
  const selectedCredentialDoc = cloudCredentialDocs.find(d => d._id === selectedCredentialId);

  const handleFormChange = debounce((newConfig: ExternalVaultConfig) => {
    const newFormValue = JSON.stringify(newConfig);
    onChange(newFormValue);
  }, 1000);
  let SubForm;

  switch (provider) {
    case 'aws':
      SubForm = (
        <AWSSecretManagerForm
          formData={formData as AWSSecretConfig}
          onChange={handleFormChange}
          activeTagData={activeTagData}
        />
      );
      break;
    case 'azure':
      SubForm = (
        <AzureKeyVaultForm
          formData={formData as AzureSecretConfig}
          onChange={handleFormChange}
          activeTagData={activeTagData}
        />
      );
      break;
    case 'gcp':
      SubForm = (
        <GCPSecretManagerForm
          formData={formData as GCPSecretConfig}
          onChange={handleFormChange}
          activeTagData={activeTagData}
        />
      );
      break;
    default:
      SubForm = null;
  };

  return (
    <>
      {selectedCredentialDoc &&
        <Button
          className="px-2 py-1 mb-[--padding-sm] h-full flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-info] text-xs hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all"
          style={{ marginTop: 'calc(var(--padding-sm) * -1)' }}
          onPress={() => setShowModal(true)}
        >
          <Icon icon="edit" /> Edit Credential
        </Button>
      }
      {SubForm}
      {showModal &&
        <CloudCredentialModal
          provider={provider}
          providerCredential={selectedCredentialDoc}
          onClose={() => setShowModal(false)}
        />
      }
    </>
  );
};
