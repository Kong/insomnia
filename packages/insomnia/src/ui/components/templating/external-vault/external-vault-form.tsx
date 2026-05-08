import React, { useMemo, useState } from 'react';
import { Button } from 'react-aria-components';

import type { CloudProviderCredential, CloudProviderName } from '~/insomnia-data';
import { models } from '~/insomnia-data';

import { debounce } from '../../../../common/misc';
import { Icon } from '../../icon';
import { CloudCredentialModal } from '../../modals/cloud-credential-modal/cloud-credential-modal';
import type { ArgConfigFormProps } from '../tag-editor-arg-sub-form';
import { AWSSecretManagerForm } from './aws-secret-manager-form';
import { AzureKeyVaultForm } from './azure-key-vault-form';
import { GCPSecretManagerForm } from './gcp-secret-manager-form';
import { HashiCorpVaultForm } from './hashicorp-vault-form';
import type {
  AWSSecretConfig,
  AzureSecretConfig,
  ExternalVaultConfig,
  GCPSecretConfig,
  HashiCorpSecretConfig,
} from './types';

const cloudCredentialType = models.cloudCredential.type;

export const ExternalVaultForm = (props: ArgConfigFormProps) => {
  const { onChange, configValue, activeTagData, docs } = props;
  const [showModal, setShowModal] = useState(false);
  const provider = activeTagData.args[0].value as CloudProviderName;
  const formData = useMemo(() => {
    return JSON.parse(configValue) as ExternalVaultConfig;
  }, [configValue]);
  const selectedCredentialId = activeTagData.args[1].value;
  const cloudCredentialDocs = (docs[cloudCredentialType] as CloudProviderCredential[]) || [];
  const selectedCredentialDoc = cloudCredentialDocs.find(d => d._id === selectedCredentialId);

  const handleFormChange = debounce((newConfig: ExternalVaultConfig) => {
    const newFormValue = btoa(JSON.stringify(newConfig));
    onChange(newFormValue);
  }, 500);
  let SubForm;

  switch (provider) {
    case 'aws': {
      SubForm = (
        <AWSSecretManagerForm
          formData={formData as AWSSecretConfig}
          onChange={handleFormChange}
          activeTagData={activeTagData}
        />
      );
      break;
    }
    case 'gcp': {
      SubForm = (
        <GCPSecretManagerForm
          formData={formData as GCPSecretConfig}
          onChange={handleFormChange}
          activeTagData={activeTagData}
        />
      );
      break;
    }
    case 'hashicorp': {
      SubForm = (
        <HashiCorpVaultForm
          formData={formData as HashiCorpSecretConfig}
          onChange={handleFormChange}
          activeTagData={activeTagData}
        />
      );
      break;
    }
    case 'azure': {
      SubForm = (
        <AzureKeyVaultForm
          formData={formData as AzureSecretConfig}
          onChange={handleFormChange}
          activeTagData={activeTagData}
        />
      );
      break;
    }
    default: {
      SubForm = null;
    }
  }

  return (
    <>
      {selectedCredentialDoc && provider !== 'azure' && (
        <Button
          className="mb-(--padding-sm) flex h-full items-center justify-center gap-2 px-2 py-1 text-xs text-(--color-info) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
          style={{ marginTop: 'calc(var(--padding-sm) * -1)' }}
          onPress={() => setShowModal(true)}
        >
          <Icon icon="edit" /> Edit Credential
        </Button>
      )}
      {SubForm}
      {showModal && (
        <CloudCredentialModal
          provider={provider}
          providerCredential={selectedCredentialDoc}
          onClose={() => setShowModal(false)}
          onComplete={() => onChange(configValue)}
        />
      )}
    </>
  );
};
