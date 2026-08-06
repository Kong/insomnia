import type { CloudProviderCredential, CloudProviderName } from 'insomnia-data';
import { models } from 'insomnia-data';
import React, { useMemo, useState } from 'react';
import { Button } from 'react-aria-components';

import { HelpTooltip } from '~/ui/components/help-tooltip';

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
  const { onChange, configValue, activeTagData, vaultPluginData, docs, onConvertLegacyTag } = props;
  const [showModal, setShowModal] = useState(false);
  const provider = activeTagData.args[0].value as CloudProviderName;
  const formData = useMemo(() => {
    return JSON.parse(configValue) as ExternalVaultConfig;
  }, [configValue]);
  const selectedCredentialIdOrCredentialKey = activeTagData.args[1].value?.toString() || '';
  const isLegacyCredentialTag = models.cloudCredential.isCloudCredentialId(selectedCredentialIdOrCredentialKey);
  const selectedCredentialId = isLegacyCredentialTag
    ? // legacy version to save cloud credential id in tag
      selectedCredentialIdOrCredentialKey
    : // new version to save cloud credential id in pluginData, and each tag will have a unique id as key to get the cloud credential id as value from pluginData
      vaultPluginData.find(data => data.key === selectedCredentialIdOrCredentialKey)?.value?.toString() || '';
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
      {isLegacyCredentialTag && (
        <div className="-mt-[calc(var(--padding-sm))] flex items-center gap-2">
          <Button
            className="mt-0 flex h-full items-center justify-center px-2 text-xs text-(--color-warning) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
            onPress={() => onConvertLegacyTag(selectedCredentialIdOrCredentialKey)}
          >
            Convert to New Format
          </Button>
          <HelpTooltip>
            Convert this tag to new format for reliable syncing in git & cloud sync projects. Note: once converted, the
            tag will only work on this version of Insomnia or later.
          </HelpTooltip>
        </div>
      )}
      {selectedCredentialDoc && provider !== 'azure' && !isLegacyCredentialTag && (
        <Button
          className="-mt-[calc(var(--padding-sm))]flex h-full items-center justify-center gap-2 px-2 py-1 text-xs text-(--color-info) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
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
