import React, { useState } from 'react';
import { Button } from 'react-aria-components';

import { debounce } from '../../../../common/misc';
import type { AWSSecretConfig } from '../../../../main/ipc/cloud-service-integration/types';
import { type CloudProviderCredential, type CloudProviderName, type } from '../../../../models/cloud-credential';
import { Icon } from '../../icon';
import { CloudCredentialModal } from '../../modals/cloud-credential-modal/cloud-credential-modal';
import type { ArgConfigFormProps } from '../tag-editor-arg-sub-form';
import { AWSSecretManagerForm } from './aws-secret-manager-form';

export const ExternalVaultForm = (props: ArgConfigFormProps) => {
  const { onChange, configValue, activeTagData, docs } = props;
  const [showModal, setShowModal] = useState(false);
  const formData = JSON.parse(configValue) as AWSSecretConfig;
  const provider = activeTagData.args[0].value as CloudProviderName;
  const selectedCredentialId = activeTagData.args[1].value;
  const cloudCredentialDocs = docs[type] as CloudProviderCredential[] || [];
  const selectedCredentialDoc = cloudCredentialDocs.find(d => d._id === selectedCredentialId);

  const handleFormChange = debounce((newConfig: AWSSecretConfig) => {
    const newFormValue = JSON.stringify(newConfig);
    onChange(newFormValue);
  }, 1000);
  let SubForm;

  switch (provider) {
    case 'aws':
      SubForm = <AWSSecretManagerForm
        formData={formData}
        onChange={handleFormChange}
        activeTagData={activeTagData}
      />;
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
